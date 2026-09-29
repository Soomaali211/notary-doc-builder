import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const partySummary = v.object({
  role: v.string(),
  name: v.string(),
  phone: v.optional(v.string()),
  idNumber: v.optional(v.string()),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ---------------------------------------------------------------
    // Notary engine — one record per document (draft or generated).
    // Values are stored as JSON (validated before insert) so the
    // engine stays configuration-driven, not schema-per-document-type.
    // ---------------------------------------------------------------
    notary_documents: defineTable({
      userId: v.id("users"),
      documentType: v.string(),
      documentTypeTitle: v.string(),
      subType: v.string(),
      subTypeLabel: v.string(),
      referenceNumber: v.string(),
      parties: v.array(partySummary),
      fileBaseName: v.string(),
      status: v.union(v.literal("draft"), v.literal("generated")),
      /** DOCX bytes of the generated document (null for drafts). */
      fileDocx: v.optional(v.union(v.id("_storage"), v.null())),
      valuesJson: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_status", ["userId", "status"])
      .index("by_reference", ["userId", "referenceNumber"])
      .index("by_user_created", ["userId", "createdAt"]),

    // Sequential counters for reference numbers, e.g. DPN-K-001.
    notary_counters: defineTable({
      key: v.string(),
      value: v.number(),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
