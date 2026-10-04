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
  /** Phase Revision — attendance + representative relationship. */
  attendance: v.optional(
    v.union(v.literal("jooga"), v.literal("ma_joogo"), v.literal("wakiil")),
  ),
  representative: v.optional(v.string()),
  representing: v.optional(v.string()),
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
    if (doc.status === "generated" || doc.status === "archived") {
      // §66 — a generated document is immutable. Autosave must never write
      // over the record that the exported file was produced from.
      throw new Error(
        "Dukumeentiga la sameeyay lama beddelo — regenerate wuxuu abuuraa version cusub.",
      );
    }

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

/** Mark an interview as completed (all sections validated, pre-generation). */
export const markCompleted = mutation({
  args: { documentId: v.id("notary_documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const doc = await ctx.db.get(documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.userId !== userId) throw new Error("Not allowed");
    if (doc.status !== "draft") throw new Error("Kaliya draft-yada ayaa la dhammaystiri karo.");
    const now = Date.now();
    // §69 — completedAt is stamped once and never moved.
    await ctx.db.patch(documentId, {
      status: "completed",
      updatedAt: now,
      completedAt: doc.completedAt ?? now,
    });
  },
});

/** Archive a generated document (hide from the active list, keep the record). */
export const archiveDocument = mutation({
  args: { documentId: v.id("notary_documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const doc = await ctx.db.get(documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.userId !== userId) throw new Error("Not allowed");
    if (doc.status !== "generated") {
      throw new Error("Kaliya dukumeentiyadii la sameeyay ayaa la kaydi karo.");
    }
    await ctx.db.patch(documentId, { status: "archived", updatedAt: Date.now() });
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

/** Metadata of one generation (template version + output paths). */
const generatedMetadataPayload = v.object({
  templateId: v.string(),
  templateVersion: v.number(),
  outputDocxPath: v.string(),
  outputPdfPath: v.optional(v.string()),
  fileName: v.string(),
});

/**
 * Phase 3 — commits a generated DOCX with metadata. IMMUTABLE: an already
 * generated document is never overwritten; regeneration must start from a
 * fresh draft (see cloneAsDraft) and creates a new version bound to the
 * same template version it was produced with.
 */
export const commitGenerated = mutation({
  args: {
    documentId: v.id("notary_documents"),
    storageId: v.id("_storage"),
    payload: savePayload,
    metadata: generatedMetadataPayload,
  },
  handler: async (ctx, { documentId, storageId, payload, metadata }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");

    const doc = await ctx.db.get(documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.userId !== userId) throw new Error("Not allowed");
    if (doc.status === "generated" || doc.status === "archived") {
      throw new Error(
        "Dukumeentiga la sameeyay lama beddelo — regenerate wuxuu abuuraa version cusub.",
      );
    }

    const now = Date.now();

    if (!jsonSizeOk(payload.valuesJson)) {
      throw new Error("Xogta aad gelisay waa mid aad u weyn.");
    }
    if (!safeBaseName(payload.fileBaseName)) {
      throw new Error("Magaca faylka waa mid aan sax ahayn.");
    }

    // A failed earlier attempt may have left a stale file behind.
    if (doc.fileDocx) {
      await ctx.storage.delete(doc.fileDocx);
    }

    await ctx.db.patch(documentId, {
      status: "generated",
      fileDocx: storageId,
      generatedMetadata: metadata,
      referenceNumber: payload.referenceNumber,
      fileBaseName: payload.fileBaseName,
      parties: payload.parties,
      valuesJson: payload.valuesJson,
      subType: payload.subType,
      subTypeLabel: payload.subTypeLabel,
      documentType: payload.documentType,
      documentTypeTitle: payload.documentTypeTitle,
      updatedAt: now,
      // §69 — the export moment, stamped once. An interview that was already
      // marked completed keeps the completion time it was given.
      exportedAt: now,
      completedAt: doc.completedAt ?? now,
    });
    return documentId;
  },
});

/**
 * Phase 3 — regenerate: clone a generated document into a fresh draft
 * carrying the same answers. The original (and its template-version
 * binding) stays untouched; the user edits the draft and generates a new
 * version. The user-entered reference stays the source of truth.
 */
export const cloneAsDraft = mutation({
  args: { documentId: v.id("notary_documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const doc = await ctx.db.get(documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.userId !== userId) throw new Error("Not allowed");
    if (doc.status !== "generated" && doc.status !== "archived") {
      throw new Error("Kaliya dukumeentiyadii la sameeyay ayaa la nuquli karo.");
    }
    const now = Date.now();
    const newId = await ctx.db.insert("notary_documents", {
      userId,
      documentType: doc.documentType,
      documentTypeTitle: doc.documentTypeTitle,
      subType: doc.subType,
      subTypeLabel: doc.subTypeLabel,
      referenceNumber: doc.referenceNumber,
      parties: doc.parties,
      fileBaseName: doc.fileBaseName,
      status: "draft",
      fileDocx: null,
      valuesJson: doc.valuesJson,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(documentId, { supersededBy: newId, updatedAt: now });
    return newId;
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
