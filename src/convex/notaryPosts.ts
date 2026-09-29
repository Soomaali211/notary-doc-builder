import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

async function authorName(ctx: QueryCtx, userId: Id<"users">): Promise<string> {
  const author = await ctx.db.get(userId);
  return author?.name || author?.email || "Xubin kooxda";
}

/** Post an update to the internal team board. */
export const create = mutation({
  args: { title: v.string(), body: v.string() },
  handler: async (ctx, { title, body }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");

    const t = title.trim();
    const b = body.trim();
    if (t.length < 2 || t.length > 120) {
      throw new Error("Cinwaanku waa inuu u dhexeeyaa 2 iyo 120 xaraf.");
    }
    if (b.length < 2 || b.length > 4000) {
      throw new Error("Fariintu waa inay u dhexeysaa 2 iyo 4000 xaraf.");
    }
    return await ctx.db.insert("notary_posts", {
      userId,
      title: t,
      body: b,
      createdAt: Date.now(),
    });
  },
});

/** Latest team posts with denormalized author names. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const posts = await ctx.db
      .query("notary_posts")
      .withIndex("by_created")
      .order("desc")
      .take(50);

    const names = new Map<Id<"users">, string>();
    for (const p of posts) {
      if (!names.has(p.userId)) {
        names.set(p.userId, await authorName(ctx, p.userId));
      }
    }
    return posts.map((p) => ({
      ...p,
      authorName: names.get(p.userId) ?? "Xubin kooxda",
    }));
  },
});

/** Remove a post (team-trusted: used from the board and the admin area). */
export const remove = mutation({
  args: { id: v.id("notary_posts") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    await ctx.db.delete(id);
  },
});
