import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const statusValidator = v.union(
  v.literal("scheduled"),
  v.literal("completed"),
  v.literal("cancelled"),
);

/** Book a signing appointment (or any team meeting). */
export const create = mutation({
  args: {
    title: v.string(),
    date: v.string(),
    time: v.string(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    documentId: v.optional(v.id("notary_documents")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");

    const title = args.title.trim();
    if (title.length < 2 || title.length > 120) {
      throw new Error("Cinwaanku waa inuu u dhexeeyaa 2 iyo 120 xaraf.");
    }
    if (!DATE_RE.test(args.date)) {
      throw new Error("Taariikhda waa mid aan sax ahayn (YYYY-MM-DD).");
    }
    if (!TIME_RE.test(args.time)) {
      throw new Error("Waqtigu waa mid aan sax ahayn (HH:MM).");
    }
    if (args.documentId !== undefined) {
      const doc = await ctx.db.get(args.documentId);
      if (!doc) throw new Error("Dukumeentiga lama helin.");
    }

    const now = Date.now();
    return await ctx.db.insert("notary_appointments", {
      userId,
      documentId: args.documentId,
      title,
      date: args.date,
      time: args.time,
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Appointments of the signed-in member, newest first. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("notary_appointments")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Admin surface (team-trusted internal tool): every appointment. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db.query("notary_appointments").order("desc").collect();
  },
});

/** Mark an appointment completed / cancelled / re-scheduled (owner only). */
export const setStatus = mutation({
  args: { id: v.id("notary_appointments"), status: statusValidator },
  handler: async (ctx, { id, status }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const appt = await ctx.db.get(id);
    if (!appt) throw new Error("Ballanta lama helin.");
    if (appt.userId !== userId) throw new Error("Not allowed");
    await ctx.db.patch(id, { status, updatedAt: Date.now() });
  },
});

/** Admin surface: change any appointment's status. */
export const adminSetStatus = mutation({
  args: { id: v.id("notary_appointments"), status: statusValidator },
  handler: async (ctx, { id, status }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const appt = await ctx.db.get(id);
    if (!appt) throw new Error("Ballanta lama helin.");
    await ctx.db.patch(id, { status, updatedAt: Date.now() });
  },
});

/** Delete one of your own appointments. */
export const remove = mutation({
  args: { id: v.id("notary_appointments") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const appt = await ctx.db.get(id);
    if (!appt) throw new Error("Ballanta lama helin.");
    if (appt.userId !== userId) throw new Error("Not allowed");
    await ctx.db.delete(id);
  },
});
