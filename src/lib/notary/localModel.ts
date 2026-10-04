/**
 * THE LOCAL DATABASE MODEL (§32).
 *
 * One interface per table in `localStore`. These are the shapes a notary's
 * office would recognise from its own filing cabinet: a person, the role that
 * person holds in one agreement, who stands for whom, the family that owns a
 * plot together, the photographs, the signature lines, the witnesses, the
 * property, the payment and the agreement itself.
 *
 * Three separations this model enforces, because they are the ones the
 * specification names:
 *
 *   §12  A ROLE is its own row. `persons` carries no "role" column: the same
 *        human being is a seller in one agreement and a buyer in another, and
 *        inside one agreement a seller may also be somebody's representative.
 *        The role lives in `partyRoles`, keyed by person id. A family
 *        relationship is NOT a role — it stays a person attribute.
 *   §32  A REPRESENTATION is its own row and is linked by id, never by name.
 *   §33  A GROUP is a name with members. It is never a person, and it has no
 *        gender field at all.
 *
 * Nothing here compares a person count with a photo count or a signature
 * count (§16). The tables are independent and nothing in the model implies
 * a relationship between their sizes.
 */

import type { StoredRecord } from "./localStore";

/** Which side of one sale a person is on. */
export type LocalRoleKind =
  | "seller"
  | "buyer"
  | "guarantor"
  | "witness"
  | "representative";

/**
 * The kind of authority a representation carries.
 *
 * §14: "wakiil" and "wakiil_qayim" are never the same thing, and the app
 * never diagnoses which one applies — the notary chooses it explicitly. The
 * union keeps the two apart in storage so a value can never be silently
 * collapsed into one field.
 */
export type LocalRepresentationType = "wakiil" | "wakiil_qayim";

/** Where the document is in its life. Same vocabulary as the office. */
export type LocalDocumentStatus = "draft" | "completed" | "generated" | "archived";

/* ------------------------------------------------------------------ */
/* Person (§12) — one human being, nothing else                       */
/* ------------------------------------------------------------------ */

export interface LocalPerson extends StoredRecord {
  kind: "person";
  /** What the office writes on the paper. */
  name: string;
  /**
   * §10 — an ANSWER the notary gave, never an inference. "unknown" is a real
   * state: the app must never read a gender out of a name.
   */
  gender: "male" | "female" | "unknown";
  phone?: string;
  address?: string;
  /**
   * §12 — "who they are TO the family" ("mother", "heir", "brother"). This is
   * DATA about the relationship. It grants no authority, it is not a role,
   * and it never changes who may sign.
   */
  familyRelationship?: string;
  /** The group this person belongs to, when a family owns the plot. */
  groupId?: string;
}

/* ------------------------------------------------------------------ */
/* PartyRole (§12) — what one person DOES in one agreement             */
/* ------------------------------------------------------------------ */

export interface LocalPartyRole extends StoredRecord {
  kind: "partyRole";
  personId: string;
  role: LocalRoleKind;
  /**
   * The office's own role word ("Iibiye", "Wakiil", "M/QIYAM", "D/MAALKA"),
   * kept verbatim. Empty string when the document prints no role word.
   */
  roleWord?: string;
  /**
   * The label printed above the signature line for this role, when the
   * document carries one. Never derived from the person's name.
   */
  signaturePrefix?: string;
}

/* ------------------------------------------------------------------ */
/* Group (§33) — a family is a NAME, never a person                    */
/* ------------------------------------------------------------------ */

export interface LocalGroup extends StoredRecord {
  kind: "group";
  name: string;
  /** Ids of the persons in this group. Never names. */
  memberIds: string[];
}

/* ------------------------------------------------------------------ */
/* Representation (§34/§14) — links, never text                        */
/* ------------------------------------------------------------------ */

export interface LocalRepresentation extends StoredRecord {
  kind: "representation";
  /** The person who acts. */
  representativeId: string;
  /** The people acted for, directly. */
  representedPersonIds: string[];
  /** A whole group acted for. Mutually exclusive with the list above. */
  representedGroupId?: string;
  type: LocalRepresentationType;
  /** Which side's document wording this authority belongs to. */
  forRole: "seller" | "buyer";
  /** The paper that grants the authority. */
  reference?: string;
  /** What the authority covers, in the office's own words. */
  scope?: string;
}

/* ------------------------------------------------------------------ */
/* Photo (§36) and Signature (§37) — independent entities              */
/* ------------------------------------------------------------------ */

export interface LocalPhoto extends StoredRecord {
  kind: "photo";
  personId: string;
  /**
   * The image itself. A data URL (base64) keeps it local — nothing is
   * uploaded anywhere, ever (§54).
   */
  dataUrl?: string;
  /** The office's caption for the photograph. */
  caption?: string;
}

export interface LocalSignature extends StoredRecord {
  kind: "signature";
  personId: string;
  /** The ROLE printed above this signature line. Never from the name. */
  prefix?: string;
  /** A drawn/typed signature image, kept local as a data URL. */
  dataUrl?: string;
}

/* ------------------------------------------------------------------ */
/* Witness (§38) — a dynamic list, never a fixed pair                  */
/* ------------------------------------------------------------------ */

export interface LocalWitness extends StoredRecord {
  kind: "witness";
  name: string;
  phone?: string;
  address?: string;
}

/* ------------------------------------------------------------------ */
/* Property (§19) and Payment — the deal's own facts                   */
/* ------------------------------------------------------------------ */

/**
 * §19 — the property is described by its SUBTYPE. Dhul Banaan, Guri and
 * Beer each carry their own fields and are never merged into one shape; the
 * common fields are the only shared ones.
 */
export interface LocalProperty extends StoredRecord {
  kind: "property";
  subtype: string;
  subtypeLabel: string;
  /** Tixraaca / TR / Notary reference, when the plot carries one. */
  reference?: string;
  /** "Calaamad Dheeraad ah" — how the notary identifies the plot otherwise. */
  description?: string;
  district?: string;
  area?: string;
  /** For Dhul Banaan: one entry per side. */
  sides?: { side: string; kind: string; detail: string }[];
  /** The subtype's own fields, kept under their own names, never merged. */
  fields?: Record<string, string>;
}

/** §18 step 5 — the money, in the office's own vocabulary. */
export interface LocalPayment extends StoredRecord {
  kind: "payment";
  totalPrice?: string;
  amountPaid?: string;
  balance?: string;
  /** Free text: no scan names the methods this office accepts. */
  method?: string;
  /** "si_buuxda" | "qayb_aad_ah". */
  state?: string;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Agreement / Draft (§40) — the document itself                       */
/* ------------------------------------------------------------------ */

/**
 * §40 — every final agreement carries its internal id, reference, type,
 * subtype, date, timestamps, status and file paths. The typed part of the
 * row; the raw form answers travel beside it as `valuesJson` so a draft
 * reopens exactly as it was left.
 */
export interface LocalAgreement extends StoredRecord {
  kind: "agreement";
  /** Human label for the draft/agreement list. */
  title?: string;
  documentType: string;
  documentTypeTitle: string;
  subType: string;
  subTypeLabel: string;
  referenceNumber: string;
  /** ISO date string, "YYYY-MM-DD" — the agreement's own date. */
  agreementDate?: string;
  status: LocalDocumentStatus;
  /** The full form state. A draft is reopened from exactly this. */
  valuesJson: string;
  /** Where the exported files went, for the record. */
  fileBaseName?: string;
  outputDocxPath?: string;
  outputPdfPath?: string;
  fileName?: string;
  /** Four moments, stamped once each and never rewritten. */
  completedAt?: number;
  exportedAt?: number;
  /** §42/§41 — the template this agreement was made from. */
  templateId?: string;
  templateName?: string;
}

/**
 * A DRAFT is the same document still being answered. It is the same fields as
 * an agreement — only `status` differs, and only the table it sits in. Drafts
 * are never a second shape to keep in sync.
 */
export type LocalDraft = Omit<LocalAgreement, "kind" | "status"> & {
  kind: "draft";
  status: "draft";
};