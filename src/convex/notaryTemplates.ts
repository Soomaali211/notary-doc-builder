/**
 * Phase Document Generation — user-created Word templates (Convex).
 *
 * The USER owns template design (layout, fonts, logo, tables, legal
 * formatting); the system only stores the .docx, records its scanned
 * placeholders, and later fills those placeholders with form data.
 *
 * Templates are append-only: uploading again creates a NEW record and a
 * NEW storage object — an original template is never overwritten.
 * Deleting retires the record and removes its storage object.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const MAX_TEMPLATE_BYTES = 15 * 1024 * 1024; // 15 MB — a Word template is small.

function safeTemplateName(name: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 120;
}

/** Upload URL for the template .docx bytes (client uploads, then commits). */
export const generateTemplateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Commit an uploaded template: the client has already scanned the
 * placeholders (listTemplateTokens) and passes them along for display.
 */
export const saveTemplate = mutation({
  args: {
    documentType: v.string(),
    subtype: v.optional(v.string()),
    name: v.string(),
    fileName: v.string(),
    storageId: v.id("_storage"),
    sizeBytes: v.number(),
    placeholdersJson: v.optional(v.string()),
    warningsJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (!safeTemplateName(args.name)) {
      throw new Error("Magaca template-ka waa mid aan sax ahayn.");
    }
    if (args.sizeBytes <= 0 || args.sizeBytes > MAX_TEMPLATE_BYTES) {
      throw new Error("Faylka template-ka waa mid aan sax ahayn ama aad u weyn.");
    }
    if (!/\.(docx)$/i.test(args.fileName)) {
      throw new Error("Kaliya faylasha .docx ayaa la oggol yahay.");
    }

    const now = Date.now();
    // An upload IS the new revision: the office edits the .docx in Word and
    // uploads it again, so the newest upload is the template in force. The
    // previous default is retired as the default (the record and its bytes
    // stay — append-only, never overwritten).
    const siblings = await ctx.db
      .query("notary_templates")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", userId).eq("documentType", args.documentType),
      )
      .collect();
    for (const t of siblings) {
      if (t.status === "active" && t.isDefault) {
        await ctx.db.patch(t._id, { isDefault: false, updatedAt: now });
      }
    }

    const id = await ctx.db.insert("notary_templates", {
      userId,
      documentType: args.documentType,
      subtype: args.subtype,
      name: args.name.trim(),
      fileName: args.fileName,
      storageId: args.storageId,
      sizeBytes: args.sizeBytes,
      placeholdersJson: args.placeholdersJson,
      warningsJson: args.warningsJson,
      isDefault: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/** All templates of the current user (optionally per document type). */
export const listMyTemplates = query({
  args: { documentType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("notary_templates")
      .withIndex("by_user_type", (q) =>
        args.documentType
          ? q.eq("userId", userId).eq("documentType", args.documentType)
          : q.eq("userId", userId),
      )
      .collect();
    return rows
      .filter((t) => t.status === "active")
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Download URL for a template's .docx bytes (owner only). */
export const getTemplateUrl = query({
  args: { templateId: v.id("notary_templates") },
  handler: async (ctx, { templateId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const tpl = await ctx.db.get(templateId);
    if (!tpl || tpl.userId !== userId) return null;
    return await ctx.storage.getUrl(tpl.storageId);
  },
});

/** Choose the default template used by new generations of one document type. */
export const setDefaultTemplate = mutation({
  args: { templateId: v.id("notary_templates") },
  handler: async (ctx, { templateId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const tpl = await ctx.db.get(templateId);
    if (!tpl || tpl.userId !== userId) throw new Error("Not allowed");

    const siblings = await ctx.db
      .query("notary_templates")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", userId).eq("documentType", tpl.documentType),
      )
      .collect();
    for (const s of siblings) {
      if (s.isDefault) await ctx.db.patch(s._id, { isDefault: false });
    }
    await ctx.db.patch(templateId, { isDefault: true, updatedAt: Date.now() });
  },
});

/** Retire a template and delete its stored bytes (originals are never edited). */
export const deleteTemplate = mutation({
  args: { templateId: v.id("notary_templates") },
  handler: async (ctx, { templateId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const tpl = await ctx.db.get(templateId);
    if (!tpl || tpl.userId !== userId) throw new Error("Not allowed");

    await ctx.storage.delete(tpl.storageId);
    await ctx.db.patch(templateId, {
      status: "retired",
      isDefault: false,
      updatedAt: Date.now(),
    });
  },
});
