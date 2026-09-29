import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

async function authorName(ctx: QueryCtx, userId: Id<"users">): Promise<string> {
  const author = await ctx.db.get(userId);
  return author?.name || author?.email || "Xubin kooxda";
}

/** Add a comment to a document. */
export const add = mutation({
  args: { documentId: v.id("notary_documents"), body: v.string() },
  handler: async (ctx, { documentId, body }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");

    const text = body.trim();
    if (text.length < 1 || text.length > 2000) {
      throw new Error("Faalladu waa inay u dhexeysaa 1 iyo 2000 xaraf.");
    }
    const doc = await ctx.db.get(documentId);
    if (!doc) throw new Error("Dukumeentiga lama helin.");

    return await ctx.db.insert("notary_comments", {
      documentId,
      userId,
      body: text,
      createdAt: Date.now(),
    });
  },
});

/** Comments for one document, oldest first (natural thread order). */
export const listByDocument = query({
  args: { documentId: v.id("notary_documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const comments = await ctx.db
      .query("notary_comments")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .order("asc")
      .take(200);

    const names = new Map<Id<"users">, string>();
    for (const c of comments) {
      if (!names.has(c.userId)) {
        names.set(c.userId, await authorName(ctx, c.userId));
      }
    }
    return comments.map((c) => ({
      ...c,
      authorName: names.get(c.userId) ?? "Xubin kooxda",
    }));
  },
});

/** Remove a comment (team-trusted: used from the thread and the admin area). */
export const remove = mutation({
  args: { id: v.id("notary_comments") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    await ctx.db.delete(id);
  },
});
