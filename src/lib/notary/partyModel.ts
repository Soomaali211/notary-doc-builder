/**
 * KALA IIBSI HANTI — PARTY MODEL (core).
 *
 * The scanned Dhul Banaan / Beer agreements all refuse to tie a person's
 * COUNT to their photo count or their signature count. One agreement may
 * name thirteen people in one family and print six photographs and six
 * signature lines, because the document signs on behalf of people who are
 * minors, absent, or already dead, and it photographs the people who
 * actually stand in the room.
 *
 * This module is therefore built around ONE rule:
 *
 *     seller_count ≠ photo_count ≠ signature_count
 *
 * Photos and signatures are their OWN lists, each linked to a PERSON. They
 * are never derived from the seller list, and nothing here validates one
 * count against another.
 *
 * It also keeps three things apart that the scans keep apart:
 *
 *     gender  ≠  role  ≠  representation
 *
 * "mother" is a family relationship; "wakiil" is a legal authority. Ruun is
 * both, because the document says so — not because one implies the other.
 *
 * Pure data + pure functions. Nothing here imports the form engine, the DOCX
 * renderer, or any document config, so Heshiis Kiro cannot be affected by it
 * in any way.
 */

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

/**
 * A person's gender. NEVER derived from their name — the office chooses it,
 * because it decides the legal wording ("iibiye" vs "iibiso").
 */
export type PartyGender = "male" | "female" | "unknown";

/**
 * The authority a representative holds. These are genuinely different:
 *
 *   wakiil       — appointed to act for someone who CAN act for themselves
 *   wakiil_qayim — appointed for someone who CANNOT legally act alone
 *                  (a minor, an heir without capacity, an absent heir)
 *
 * The scans show both, and they are not interchangeable: "wakiil_qayim"
 * carries a different legal consequence about the represented person's own
 * capacity. Open to further kinds once a scan shows one — this is a plain
 * string, so adding one needs no change here.
 */
export type RepresentationType = "wakiil" | "wakiil_qayim" | (string & {});

/** How many people the word should describe. */
export type PartyNumber = "singular" | "plural";

/** The party the word refers to. */
export type PartyRole = "seller" | "buyer" | "guarantor";

/* ------------------------------------------------------------------ */
/* Gender word engine                                                  */
/* ------------------------------------------------------------------ */

/**
 * The legal role words, declared as DATA so a spelling decision later is a
 * data change and never a code change.
 *
 * Grammar here is two-dimensional and they multiply — this is why the office
 * forbids a plain find-and-replace. "iibiye" → "iibisada" is wrong twice over:
 * it changes the gender AND it changes definiteness.
 *
 * The plural row carries no gender on purpose: the plural of a role is one
 * word whether the group is all men, all women, or mixed.
 *
 * OPEN DECISION (see OPEN_DECISIONS below): these literals are transcribed
 * from the approved specification, not read off a scan.
 */
export const GENDER_WORDS: Record<
  PartyRole,
  Record<PartyNumber, Record<PartyGender, string | undefined>>
> = {
  seller: {
    singular: {
      male: "iibiye",
      female: "iibiso",
      unknown: undefined,
    },
    plural: {
      male: "iibiyayaal",
      female: "iibiyayaal",
      unknown: "iibiyayaal",
    },
  },
  buyer: {
    singular: {
      male: "iibsade",
      female: "iibsato",
      unknown: undefined,
    },
    plural: {
      male: "iibsadayaal",
      female: "iibsadayaal",
      unknown: "iibsadayaal",
    },
  },
  guarantor: {
    singular: {
      male: "damiin",
      female: "damiin",
      unknown: undefined,
    },
    plural: {
      male: "damiino",
      female: "damiino",
      unknown: "damiino",
    },
  },
};

/** The definite ("iibiyaha") variant of every word above. */
export const GENDER_WORDS_DEFINITE: Record<
  PartyRole,
  Record<PartyNumber, Record<PartyGender, string | undefined>>
> = {
  seller: {
    singular: { male: "iibiyaha", female: "iibisada", unknown: undefined },
    plural: { male: "iibiyayaasha", female: "iibiyayaasha", unknown: "iibiyayaasha" },
  },
  buyer: {
    singular: { male: "iibsadaha", female: "iibsatada", unknown: undefined },
    plural: { male: "iibsadayaasha", female: "iibsadayaasha", unknown: "iibsadayaasha" },
  },
  guarantor: {
    singular: { male: "damiinka", female: "damiinka", unknown: undefined },
    plural: { male: "damiinnada", female: "damiinnada", unknown: "damiinnada" },
  },
};

/**
 * Questions this module deliberately refuses to answer.
 *
 * Anything listed here is a legal-wording decision the office owns. The
 * engine returns `undefined` for them instead of inventing a word, so an
 * unresolved choice can never reach a signed document by accident.
 */
export const OPEN_DECISIONS = {
  /**
   * The literal spelling of the plural. The specification says "iibiyayaal",
   * but the Beer scan prints "IIBIYAYAASHA" and the existing config uses
   * "IIBIYEYAAL". Three spellings are in play and no scan settles which is
   * the office's word. Picked "iibiyayaal" as the transcribed value; change
   * it in GENDER_WORDS and nothing else moves.
   */
  pluralSpelling: "iibiyayaal | iibiyooyal | iibiyeyaal",

  /**
   * Whether a mixed-gender group ever needs a DIFFERENT plural word from a
   * single-gender group. The table above says no; no scan confirms it.
   */
  mixedGenderPlural: "open — plural is treated as gender-independent",

  /**
   * The word for a singular person whose gender has not been chosen.
   * "unknown" returns undefined rather than defaulting to a gender.
   */
  unknownGenderSingular: "open — undefined, never guessed",

  /**
   * Gendered forms for the guarantor role are absent from every scan read so
   * far (both scans print "DAMIINAL MAAL" / "D/MAALKA", uninflected). The
   * values above are placeholders pending the office's word.
   */
  guarantorWords: "open — transcribed, not scan-verified",
} as const;

/**
 * The legal word for one role, gender, number and definiteness.
 *
 * Returns `undefined` when the combination has no agreed word — currently
 * only a singular person whose gender was never chosen. The caller is
 * expected to surface that as a question to the notary, never to print a
 * blank where a legal word belongs and never to guess.
 */
export function genderWord(input: {
  role: PartyRole;
  gender: PartyGender;
  number: PartyNumber;
  definite?: boolean;
  words?: Record<PartyRole, Record<PartyNumber, Record<PartyGender, string | undefined>>>;
}): string | undefined {
  const table =
    input.words ?? (input.definite ? GENDER_WORDS_DEFINITE : GENDER_WORDS);
  return table[input.role]?.[input.number]?.[input.gender];
}

/* ------------------------------------------------------------------ */
/* Entities — each is its own thing                                    */
/* ------------------------------------------------------------------ */

/** A supporting document: an inheritance record, a POA, a title. */
export interface PersonCertificate {
  id: string;
  /** As printed on the document: "MDH/C/842/2025", "Ref:APN/096/2025". */
  reference: string;
  /** What kind of paper it is, in the office's own words. */
  kind?: string;
  issuedOn?: string;
  issuedBy?: string;
  /** WHO the paper is about: a person id, a group id, or "". */
  aboutPersonId?: string;
  aboutGroupId?: string;
}

/** One human being. Never a family. Never a role. */
export interface Person {
  id: string;
  name: string;
  gender: PartyGender;
  /** "mother", "heir", "brother" … a relationship, NOT an authority. */
  familyRelationship?: string;
  /** Dead heirs are named in the scans but never sign or appear. */
  deceased?: boolean;
  phone?: string;
  address?: string;
  /** The seller group this person belongs to, if any. */
  groupId?: string;
  certificates?: PersonCertificate[];
}

/** A family / co-ownership group. A NAME, never a person. */
export interface SellerGroup {
  id: string;
  name: string;
  memberIds: string[];
  certificates?: PersonCertificate[];
}

/**
 * One authority relationship.
 *
 * A representative may stand for ONE person, a SUBSET of a group, or the
 * WHOLE group. Several representatives may split one group between them, and
 * one representative may cover many people — the model allows both because
 * the Beer scan shows both.
 */
export interface Representation {
  id: string;
  /** The person acting. */
  representativeId: string;
  /** People acted for directly. */
  representedPersonIds?: string[];
  /** A whole group acted for (mutually exclusive with the list above). */
  representedGroupId?: string;
  type: RepresentationType;
  /** The paper that grants the authority: "Ref:APN/096/2025". */
  reference?: string;
  /** What the authority covers — the office's own words, kept verbatim. */
  scope?: string;
  /** A family relationship is DATA on the person, never a grant of power. */
  relationship?: string;
}

/**
 * A photograph, attached to a person — never to a "seller slot".
 *
 * The number of photographs is decided by the document, not by how many
 * sellers there are.
 */
export interface PersonPhoto {
  id: string;
  personId: string;
  /** Convex storage id. */
  storageId: string;
  /** "Iibsato | Faadumo | Maxamed | Jibril" — the office's own caption. */
  caption?: string;
}

/**
 * A signature line, attached to a person.
 *
 * The prefix ("IIBISO/WAKIIL", "M/QIYAM") is the ROLE printed above the
 * name. It is chosen by the notary for that line; it is never assembled from
 * the person's name, and it is not a gender word on its own.
 */
export interface PersonSignature {
  id: string;
  personId: string;
  /** "IIBIYE" | "IIBISO/WAKIIL" | "M/QIYAM" | "D/MAALKA" … */
  prefix?: string;
}

/** The whole party picture of one document. */
export interface PartyModel {
  people: Person[];
  groups: SellerGroup[];
  representations: Representation[];
  photos: PersonPhoto[];
  signatures: PersonSignature[];
  certificates: PersonCertificate[];
}

/* ------------------------------------------------------------------ */
/* Graph resolution                                                    */
/* ------------------------------------------------------------------ */

/** Look one person up. */
export function personById(model: PartyModel, id: string): Person | undefined {
  return model.people.find((p) => p.id === id);
}

/** Look one group up. */
export function groupById(model: PartyModel, id: string): SellerGroup | undefined {
  return model.groups.find((g) => g.id === id);
}

/**
 * Expand one authority into the people it actually covers.
 *
 * `representedGroupId` expands to that group's members; a person list is
 * taken as written. An empty result means the edge names nobody, which is a
 * data problem to surface — never a reason to fall back to "everyone".
 */
export function representedPeople(
  model: PartyModel,
  edge: Representation,
): Person[] {
  const ids = new Set(edge.representedPersonIds ?? []);
  if (edge.representedGroupId) {
    for (const id of groupById(model, edge.representedGroupId)?.memberIds ?? []) {
      ids.add(id);
    }
  }
  return [...ids]
    .map((id) => personById(model, id))
    .filter((p): p is Person => Boolean(p));
}

/**
 * Reverse index: who represents this person.
 *
 * A person can be covered by several representatives (the Beer scan shows
 * Ruun named both as a co-owner in her own right and as the appointed
 * representative of the fourth branch), so this returns a LIST, never a
 * single id.
 */
export function representativesOf(model: PartyModel, personId: string): Representation[] {
  return model.representations.filter((edge) =>
    representedPeople(model, edge).some((p) => p.id === personId),
  );
}

/**
 * The people who sign, and who does not.
 *
 * Being a seller does not make someone a signatory, and having a photograph
 * does not make someone a signatory. Those are two independent lists and
 * this function only joins them.
 */
export function signatoriesOf(model: PartyModel): { person: Person; signature: PersonSignature }[] {
  return model.signatures
    .map((signature) => ({ signature, person: personById(model, signature.personId) }))
    .filter((row): row is { person: Person; signature: PersonSignature } => Boolean(row.person));
}

/** The people who are photographed — an independent list. */
export function photographedOf(model: PartyModel): { person: Person; photo: PersonPhoto }[] {
  return model.photos
    .map((photo) => ({ photo, person: personById(model, photo.personId) }))
    .filter((row): row is { person: Person; photo: PersonPhoto } => Boolean(row.person));
}

/** Everyone holding any authority. */
export function representatives(model: PartyModel): Person[] {
  return model.representations
    .map((edge) => personById(model, edge.representativeId))
    .filter((p): p is Person => Boolean(p));
}

/* ------------------------------------------------------------------ */
/* The counts the document decides                                      */
/* ------------------------------------------------------------------ */

export interface PartyCounts {
  people: number;
  groups: number;
  sellers: number;
  photos: number;
  signatures: number;
  witnesses: number;
  representatives: number;
}

/**
 * Count what the document actually carries.
 *
 * There is deliberately NO comparison here — no "photos must equal sellers",
 * no "signatures must equal sellers", no "photos must equal signatures".
 * Those numbers are independent by design, and this function exists to make
 * that independence visible instead of accidental.
 */
export function countParties(
  model: PartyModel,
  options: { sellerIds?: string[]; witnessIds?: string[] } = {},
): PartyCounts {
  const sellers = options.sellerIds ?? model.people.map((p) => p.id);
  const witnesses = options.witnessIds ?? [];
  return {
    people: model.people.length,
    groups: model.groups.length,
    sellers: sellers.length,
    photos: model.photos.length,
    signatures: model.signatures.length,
    witnesses: witnesses.length,
    representatives: representatives(model).length,
  };
}

/* ------------------------------------------------------------------ */
/* Questions the model asks on its own answers                         */
/* ------------------------------------------------------------------ */

export interface PartyModelIssue {
  code: string;
  personId?: string;
  message: string;
}

/**
 * Structural problems worth reporting — never auto-fixes.
 *
 * What is deliberately NOT checked:
 *   • a seller without a photograph
 *   • a seller without a signature line
 *   • a photographed person without a signature
 *   • the gender of a person nobody had to name in the document
 */
export function inspectPartyModel(model: PartyModel): PartyModelIssue[] {
  const issues: PartyModelIssue[] = [];
  const seen = new Set<string>();
  for (const p of model.people) {
    if (seen.has(p.id)) {
      issues.push({
        code: "duplicate_person_id",
        personId: p.id,
        message: `Qof laba jeer ayaa la sameeyay: ${p.name}`,
      });
    }
    seen.add(p.id);
  }
  for (const group of model.groups) {
    for (const memberId of group.memberIds) {
      if (!personById(model, memberId)) {
        issues.push({
          code: "group_member_missing",
          message: `"${group.name}": xubni ma jiro — ${memberId}`,
        });
      }
    }
  }
  for (const edge of model.representations) {
    if (!personById(model, edge.representativeId)) {
      issues.push({
        code: "representative_missing",
        message: `Wakiil ma jiro: ${edge.representativeId}`,
      });
    }
    if (representedPeople(model, edge).length === 0) {
      issues.push({
        code: "representation_empty",
        message: `Wakiil "${edge.representativeId}" lama matalayso qof`,
      });
    }
  }
  for (const photo of model.photos) {
    if (!personById(model, photo.personId)) {
      issues.push({
        code: "photo_orphan",
        message: `Sawir qof aan jirin: ${photo.personId}`,
      });
    }
  }
  for (const signature of model.signatures) {
    if (!personById(model, signature.personId)) {
      issues.push({
        code: "signature_orphan",
        message: `Saxeex qof aan jirin: ${signature.personId}`,
      });
    }
  }
  return issues;
}
