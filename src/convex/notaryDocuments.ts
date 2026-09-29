import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/* ------------------------------------------------------------------ */
/* Shared validators                                                   */
/* ------------------------------------------------------------------ */

const partySummary = v.object({
  role: v.string(),
  name: v.string(),
  phone: v.optional(v.string()),
  idNumber: v.optional(v.string()),
});

const savePayload = v.object({
  documentType: v.string(),
  documentTypeTitle: v.string(),
  subType: v.string(),
  subTypeLabel: v.string(),
  referenceNumber: v.string(),
  fileBaseName: v.string(),
  parties: v.array(partySummary),
  /** JSON.stringify of the FormValues — validated server-side below. */
  valuesJson: v.string(),
});

/** Only allow sane, non-traversal filenames. */
function safeBaseName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9\-_.]{0,118}$/.test(name);
}

/** Reference numbers like DPN-K-001 (letters, digits, dashes). */
function safeReference(ref: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9\-]{0,48}$/.test(ref);
}

function jsonSizeOk(valuesJson: string): boolean {
  // ~1MB cap protects the document row.
  return valuesJson.length <= 1_000_000;
}

/* ------------------------------------------------------------------ */
/* Counters — sequential reference numbers                             */
/* ------------------------------------------------------------------ */

export const nextReference = mutation({
  args: { prefix: v.string() },
  handler: async (ctx, { prefix }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (!safeReference(prefix)) throw new Error("Invalid reference prefix");

    const key = `${userId}:${prefix}`;
    const counter = await ctx.db
      .query("notary_counters")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    const value = (counter?.value ?? 0) + 1;
    const padded = String(value).padStart(3, "0");
    const reference = `${prefix}-${padded}`;

    if (counter) {
      await ctx.db.patch(counter._id, { value });
    } else {
      await ctx.db.insert("notary_counters", { key, value });
    }
    return reference;
  },
});

/* ------------------------------------------------------------------ */
/* Drafts                                                              */
/* ------------------------------------------------------------------ */

/** Create an empty draft once the user picks a document type + sub-type. */
export const createDraft = mutation({
  args: {
    documentType: v.string(),
    documentTypeTitle: v.string(),
    subType: v.string(),
    subTypeLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const now = Date.now();
    return await ctx.db.insert("notary_documents", {
      userId,
      documentType: args.documentType,
      documentTypeTitle: args.documentTypeTitle,
      subType: args.subType,
      subTypeLabel: args.subTypeLabel,
      referenceNumber: "",
      parties: [],
      fileBaseName: "",
      status: "draft",
      fileDocx: null,
      valuesJson: JSON.stringify({}),
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Upsert the interview values + party summary into a draft. */
export const saveDraft = mutation({
  args: {
    documentId: v.id("notary_documents"),
    payload: savePayload,
  },
  handler: async (ctx, { documentId, payload }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");

    const doc = await ctx.db.get(documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.userId !== userId) throw new Error("Not allowed");

    if (!jsonSizeOk(payload.valuesJson)) {
      throw new Error("Xogta aad gelisay waa mid aad u weyn.");
    }
    if (payload.referenceNumber && !safeReference(payload.referenceNumber)) {
      throw new Error("Nambarka tixraaca waa mid aan sax ahayn.");
    }
    if (!safeBaseName(payload.fileBaseName)) {
      throw new Error("Magaca faylka waa mid aan sax ahayn.");
    }

    // Parse-check the JSON so we never store corrupt values.
    const parsed = JSON.parse(payload.valuesJson);
    if (parsed === null || typeof parsed !== "object") {
      throw new Error("Xogta heshiiska waa mid aan sax ahayn.");
    }

    await ctx.db.patch(documentId, {
      documentType: payload.documentType,
      documentTypeTitle: payload.documentTypeTitle,
      subType: payload.subType,
      subTypeLabel: payload.subTypeLabel,
      referenceNumber: payload.referenceNumber,
      parties: payload.parties,
      fileBaseName: payload.fileBaseName,
      valuesJson: payload.valuesJson,
      updatedAt: Date.now(),
    });
    return documentId;
  },
});

/** Delete a draft (only drafts, not archived documents). */
export const deleteDraft = mutation({
  args: { documentId: v.id("notary_documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const doc = await ctx.db.get(documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.userId !== userId) throw new Error("Not allowed");
    if (doc.status === "generated") {
      throw new Error("Dukumeenti la sameeyay lama tirtiri karo kaydka.");
    }
    await ctx.db.delete(documentId);
  },
});

/** Admin surface (team-trusted internal tool): every document in the workspace. */
export const listAllDocuments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db.query("notary_documents").order("desc").collect();
  },
});

/** Admin surface: delete any draft (never a generated document). */
export const adminDeleteDraft = mutation({
  args: { documentId: v.id("notary_documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const doc = await ctx.db.get(documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.status !== "draft") {
      throw new Error("Kaliya draft-yada ayaa la tirtiri karo.");
    }
    await ctx.db.delete(documentId);
  },
});

/* ------------------------------------------------------------------ */
/* Generation (action) — rollback-safe                                 */
/* ------------------------------------------------------------------ */

/** Upload URL for the generated DOCX bytes (client uploads, then commits). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Commits a generated DOCX: stores bytes in file storage and flips the
 * document to "generated". Called by the client AFTER the DOCX was built
 * successfully in the browser. If the client fails before calling this,
 * the draft remains intact — user data is never lost.
 */
export const commitGenerated = mutation({
  args: {
    documentId: v.id("notary_documents"),
    storageId: v.id("_storage"),
    payload: savePayload,
  },
  handler: async (ctx, { documentId, storageId, payload }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");

    const doc = await ctx.db.get(documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.userId !== userId) throw new Error("Not allowed");

    if (!jsonSizeOk(payload.valuesJson)) {
      throw new Error("Xogta aad gelisay waa mid aad u weyn.");
    }
    if (!safeBaseName(payload.fileBaseName)) {
      throw new Error("Magaca faylka waa mid aan sax ahayn.");
    }

    // If a previous generation left a file behind, replace it.
    if (doc.fileDocx) {
      await ctx.storage.delete(doc.fileDocx);
    }

    await ctx.db.patch(documentId, {
      status: "generated",
      fileDocx: storageId,
      referenceNumber: payload.referenceNumber,
      fileBaseName: payload.fileBaseName,
      parties: payload.parties,
      valuesJson: payload.valuesJson,
      subType: payload.subType,
      subTypeLabel: payload.subTypeLabel,
      documentType: payload.documentType,
      documentTypeTitle: payload.documentTypeTitle,
      updatedAt: Date.now(),
    });
    return documentId;
  },
});

/** Undo a failed generation: keeps the draft, clears any stale file ref. */
export const rollbackGeneration = internalMutation({
  args: { documentId: v.id("notary_documents") },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return;
    if (doc.fileDocx) {
      await ctx.storage.delete(doc.fileDocx);
    }
    await ctx.db.patch(documentId, { status: "draft", fileDocx: null });
  },
});

/* ------------------------------------------------------------------ */
/* Archive — queries                                                   */
/* ------------------------------------------------------------------ */

/** All documents of the current user, newest first. */
export const listMyDocuments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("notary_documents")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getDocument = query({
  args: { documentId: v.id("notary_documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) return null;
    return doc;
  },
});

/** URL for downloading the generated DOCX from Convex file storage. */
export const getDocxUrl = query({
  args: { documentId: v.id("notary_documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId || !doc.fileDocx) return null;
    return await ctx.storage.getUrl(doc.fileDocx);
  },
});
