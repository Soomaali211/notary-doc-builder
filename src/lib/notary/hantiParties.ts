/**
 * KALA IIBSI HANTI — Form answers → party graph.
 *
 * The interview collects flat, repeatable rows; the document needs the real
 * thing: people who hold roles, people represented by other people, a family
 * group that has a NAME but is nobody, and two entirely separate lists of
 * photographs and signature lines.
 *
 * This module is the ONLY bridge between the two, and it is deliberately
 * dumb about counts. Nothing here says a photo needs a seller, a signature
 * needs a photo, or a representative needs a seller — the Beer scan shows
 * thirteen named sellers printed next to eight photographs and six signature
 * lines, and that document is legal. Any future check of that shape would be
 * a bug, not a feature.
 *
 * Linkage is by NAME, because that is what the office writes on the paper
 * ("Ilma Xassan Qaalib") and what the notary reads out loud. A photo row, a
 * signature row and a seller row all point at each other by the person's
 * name; when a name does not resolve, the model reports it instead of
 * silently attaching the photo to the wrong human being.
 *
 * Pure functions only — no form engine, no DOCX, no Kiro involvement.
 */

import type { FormValues, PartyRow } from "./types";
import {
  inspectPartyModel,
  type PartyGender,
  type PartyModel,
  type Person,
  type PersonCertificate,
  type PersonPhoto,
  type PersonSignature,
  type Representation,
  type SellerGroup,
} from "./partyModel";

/* ------------------------------------------------------------------ */
/* Storage keys — the config and this bridge must agree on these       */
/* ------------------------------------------------------------------ */

export const HANTI_KEYS = {
  sellers: "iibiyeyaal",
  buyers: "iibsadayaal",
  groups: "kooxaha",
  witnesses: "maragyo",
  /** The wakiil list. NOT "wakiilo_*": that prefix is the attendance engine's. */
  representatives: "wakiillo",
  photos: "sawirrada",
  signatures: "saxeexayaasha",
  certificates: "shaxadaha",
} as const;

/** Row fields this bridge reads. Anything else in a row is ignored. */
const FIELD = {
  name: "magac",
  gender: "jinsi",
  role: "dooro",
  status: "xaalad",
  relationship: "xiriirka_qoyska",
  /** A picker value: the person's ID (never their name). */
  person: "shakhsiga",
  group: "koox",
  representative: "wakiil",
  repType: "nooca_wakiilka",
  repRef: "tixraaca_wakiilnimo",
  repScope: "xadka_wakiilnimo",
  photo: "sawir",
  caption: "caption",
  prefix: "prefix",
  address: "degan",
  phone: "telefoon",
  certRef: "tixraaca",
  certKind: "nooca_shaxadaha",
  certAbout: "haysa",
  certDate: "taariikhda",
} as const;

/* ------------------------------------------------------------------ */
/* Row helpers                                                         */
/* ------------------------------------------------------------------ */

function rowsOf(values: FormValues, key: string): PartyRow[] {
  const raw = values[key];
  return Array.isArray(raw) ? (raw as PartyRow[]) : [];
}

/** A row counts as filled when any of its values carries text. */
function filled(rows: PartyRow[]): PartyRow[] {
  return rows.filter((r) =>
    Object.values(r.values ?? {}).some((v) => (v ?? "").trim() !== ""),
  );
}

/**
 * A person is a row with a NAME.
 *
 * `filled()` alone is not enough. Any value at all — a pre-set default, a
 * stray selection — marks a row as "filled", and an unnamed row would then
 * become a phantom person with an empty name and print a blank line in the
 * document. A party without a name is nobody, so it is dropped here.
 */
function named(rows: PartyRow[]): PartyRow[] {
  return filled(rows).filter((r) => text(r, FIELD.name) !== "");
}

/**
 * Two names are the same name for the SELLER/BUYER clash check only.
 *
 * Case and surrounding space are noise; nothing else is. This is not fuzzy
 * matching and it is not an identity: "Ahmed Cali" and "Ahmed Cali" clash,
 * "Ahmed" and "Ahmed Cali" do not. Every other link in this model is by id.
 */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) !== "" && norm(a) === norm(b);
}

const text = (row: PartyRow | undefined, field: string): string =>
  (row?.values?.[field] ?? "").trim();

/**
 * A stored gender answer. Anything unrecognised becomes "unknown" — and
 * "unknown" is a real, respected state that the gender-word engine refuses
 * to guess past, not an error and not a default.
 */
function genderOf(row: PartyRow | undefined): PartyGender {
  const v = text(row, FIELD.gender);
  return v === "male" || v === "female" ? v : "unknown";
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

export interface HantiPartyOptions {
  /**
   * Which rows count as sellers. Defaults to every filled seller row. A
   * caller that only wants the people who actually carry the seller role can
   * pass its own list; the default never inspects photos or signatures.
   */
  sellerRows?: PartyRow[];
}

/**
 * Assemble the whole party picture of one Kala Iibsi Hanti document.
 *
 * The order matters and is fixed:
 *   1. groups   — a family has a NAME and must exist before its members
 *      can point at it
 *   2. people   — sellers and buyers, ONE list each, never duplicated
 *   3. representatives — resolved against the people already built
 *   4. photos / signatures — independent lists linked to a person
 *   5. certificates — about a person, a group, or an authority
 */
export function buildHantiPartyModel(
  values: FormValues,
  options: HantiPartyOptions = {},
): PartyModel {
  /* 1 — groups. A group is a NAME; it is never a person. */
  const groups: SellerGroup[] = filled(rowsOf(values, HANTI_KEYS.groups))
    .map((row, i) => ({
      id: row.id || `g${i}`,
      name: text(row, FIELD.name),
      memberIds: [] as string[],
    }))
    .filter((g) => g.name !== "");

  /* 2 — people. Sellers and buyers are built into ONE list, keyed by row id,
     so a person who appears on both sides is still one person. */
  const people: Person[] = [];
  /** Row id → the representative NAME that row points at. Filled while the
   *  people are built, so nothing has to be re-scanned afterwards. */
  const repByRowId = new Map<string, string>();
  const sellerRows = options.sellerRows ?? named(rowsOf(values, HANTI_KEYS.sellers));
  for (const row of sellerRows) {
    const person: Person = {
      id: row.id,
      name: text(row, FIELD.name),
      gender: genderOf(row),
      address: text(row, FIELD.address),
      phone: text(row, FIELD.phone),
    };
    const role = text(row, FIELD.role);
    // ROLE and FAMILY RELATIONSHIP are different facts, stored separately: a
    // role is what the person does in THIS sale; a relationship is who they
    // are to the family. Neither is ever read from the name.
    if (role) person.role = role;
    const relationship = text(row, FIELD.relationship);
    if (relationship) person.familyRelationship = relationship;
    const status = text(row, FIELD.status);
    if (status) person.status = status;
    repByRowId.set(person.id, text(row, FIELD.representative));
    const groupName = text(row, FIELD.group);
    const group = groups.find((g) => g.name === groupName);
    if (group) {
      person.groupId = group.id;
      group.memberIds.push(person.id);
    }
    if (person.name) people.push(person);
  }
  // Names resolve from the SAME people list, so a buyer without a name is
  // never a link target either.
  const roleConflicts: { sellerId: string; buyerId: string; name: string }[] = [];
  for (const row of named(rowsOf(values, HANTI_KEYS.buyers))) {
    repByRowId.set(row.id, text(row, FIELD.representative));
    const name = text(row, FIELD.name);
    // A person cannot sell and buy the same plot. The two sides are separate
    // lists, so the only way to see the clash is the name the notary typed —
    // used HERE, for this check, and nowhere else in the model.
    const clash = sellerRows.find((s) => sameName(text(s, FIELD.name), name));
    if (clash) {
      roleConflicts.push({ sellerId: clash.id, buyerId: row.id, name });
    }
    people.push({
      id: row.id,
      name,
      gender: genderOf(row),
      address: text(row, FIELD.address),
      phone: text(row, FIELD.phone),
    });
  }

  /* 3 — representations. Built AFTER the people so that a representative
     who is himself a seller resolves to the same person, not a second copy
     of him (Ruun is both, in the scan). */
  const peopleByName = new Map(people.filter((p) => p.name).map((p) => [p.name, p]));
  /** ID → person. The picker stores an ID, so this is the REAL link. */
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const representations: Representation[] = [];
  for (const row of filled(rowsOf(values, HANTI_KEYS.representatives))) {
    const name = text(row, FIELD.name);
    // A representative is a PERSON, whether or not he also happens to be one
    // of the sellers. Most wakiillo in the scans are exactly that — an uncle
    // who signs for his nephews and owns nothing himself — so an unmatched
    // name adds a person rather than dropping the authority on the floor.
    let rep = peopleByName.get(name);
    if (!rep && name) {
      rep = {
        id: row.id,
        name,
        gender: genderOf(row),
        familyRelationship: text(row, FIELD.relationship) || undefined,
      };
      people.push(rep);
      peopleByName.set(name, rep);
    }
    if (!rep) continue;
    const type = text(row, FIELD.repType) || "wakiil";
    const ref = text(row, FIELD.repRef);
    const scope = text(row, FIELD.repScope);
    // Every person whose row names THIS representative. A representative may
    // stand for many people; two representatives may split one group.
    const representedPersonIds = people
      .filter((p) => repByRowId.get(p.id) === name)
      .map((p) => p.id);
    representations.push({
      id: row.id,
      representativeId: rep.id,
      representedPersonIds,
      type: type as Representation["type"],
      ...(ref ? { reference: ref } : {}),
      ...(scope ? { scope } : {}),
    });
  }

  /* 4 — photographs and signatures. Two independent lists, each linked to a
     person. The counts are whatever the notary entered. */
  /**
   * Find the person a photo/signature row names, or ADD them.
   *
   * The Beer scan photographs a "D/MAALKA" who is neither one of the
   * thirteen sellers nor the buyer — he is in the room and on the paper, so
   * he is a PERSON and the model says so. Dropping his photograph because
   * he is not in another list would lose a real face off a real document.
   *
   * A row with no name at all stays unresolved, and inspectPartyModel reports
   * it: that is a genuine data problem, not a person we invented.
   */
  const ensurePerson = (name: string, id: string): Person => {
    const known = peopleByName.get(name);
    if (known) return known;
    const person: Person = { id, name, gender: "unknown" };
    people.push(person);
    peopleByName.set(name, person);
    return person;
  };

  /**
   * Resolve the person a photo/signature/picker row points at.
   *
   * The picker stores a person ID — the real link — and the name is only the
   * label. The name fallback keeps drafts written before the picker readable;
   * a value that is neither stays unresolved so inspectPartyModel reports it
   * rather than attaching a photograph to the wrong human being.
   */
  const resolvePerson = (value: string): Person | undefined =>
    (value ? peopleById.get(value) : undefined) ??
    (value ? peopleByName.get(value) : undefined);

  const photos: PersonPhoto[] = [];
  for (const row of filled(rowsOf(values, HANTI_KEYS.photos))) {
    const raw = text(row, FIELD.person) || text(row, FIELD.name);
    const person = raw ? resolvePerson(raw) ?? ensurePerson(raw, row.id) : undefined;
    if (!person) {
      photos.push({ id: row.id, personId: row.id, storageId: text(row, FIELD.photo) });
      continue;
    }
    const caption = text(row, FIELD.caption);
    photos.push({
      id: row.id,
      personId: person.id,
      storageId: text(row, FIELD.photo),
      ...(caption ? { caption } : {}),
    });
  }

  const signatures: PersonSignature[] = [];
  for (const row of filled(rowsOf(values, HANTI_KEYS.signatures))) {
    const raw = text(row, FIELD.person) || text(row, FIELD.name);
    // A signature line belongs to somebody; an unresolved row stays unresolved
    // so the inspector can report it.
    const person = raw ? resolvePerson(raw) ?? ensurePerson(raw, row.id) : undefined;
    const prefix = text(row, FIELD.prefix);
    signatures.push({
      id: row.id,
      personId: person ? person.id : row.id,
      ...(prefix ? { prefix } : {}),
    });
  }

  /* 5 — certificates. Each paper is about a person, a group, or a grant of
     authority; the scan shows a whole run of them (MDH/C/839…842/2025). */
  const certificates: PersonCertificate[] = [];
  for (const row of filled(rowsOf(values, HANTI_KEYS.certificates))) {
    const ref = text(row, FIELD.certRef);
    if (!ref) continue;
    const aboutName = text(row, FIELD.certAbout);
    const aboutPerson = peopleByName.get(aboutName);
    const aboutGroup = groups.find((g) => g.name === aboutName);
    const kind = text(row, FIELD.certKind);
    const issuedOn = text(row, FIELD.certDate);
    certificates.push({
      id: row.id,
      reference: ref,
      ...(kind ? { kind } : {}),
      ...(issuedOn ? { issuedOn } : {}),
      ...(aboutPerson ? { aboutPersonId: aboutPerson.id } : {}),
      ...(aboutGroup ? { aboutGroupId: aboutGroup.id } : {}),
    });
  }

  return {
    people,
    groups,
    representations,
    photos,
    signatures,
    certificates,
    // Only when there IS a clash — a clean sale carries no conflicts at all.
    ...(roleConflicts.length > 0 ? { roleConflicts } : {}),
  };
}



/* ------------------------------------------------------------------ */
/* Questions the notary should be asked                                */
/* ------------------------------------------------------------------ */

export interface HantiPartyIssue {
  code: string;
  message: string;
  personId?: string;
}

/**
 * Everything the office must look at before this document is signed.
 *
 * Deliberately absent: "a seller has no photo", "a seller has no signature",
 * "a photo has no signature". Those are not mistakes — they are the normal
 * shape of a family sale, and the document that forbids them is the document
 * the office gets wrong.
 */
export function inspectHantiParties(model: PartyModel): HantiPartyIssue[] {
  const structural = inspectPartyModel(model).map((issue) => ({
    code: issue.code,
    message: issue.message,
    ...(issue.personId ? { personId: issue.personId } : {}),
  }));
  // Selling and buying the same plot is refused, not warned about.
  const both = (model.roleConflicts ?? []).map((c) => ({
    code: "seller_is_buyer",
    message: `${c.name}: qof isku mid ah lama siin karo iibin iyo iibsad role isla heshiiska.`,
    personId: c.buyerId,
  }));
  return [...structural, ...both];
}

/**
 * The people whose gender was never chosen, so the legal word that describes
 * them personally is still unknown.
 *
 * This is a QUESTION for the notary, not an error and not a guess: printing
 * the masculine by default would put the wrong word into a signed contract,
 * so the gender-word engine returns nothing instead (see
 * partyModel.OPEN_DECISIONS.unknownGenderSingular).
 */
export function unknownGenderPeople(model: PartyModel): Person[] {
  return model.people.filter((p) => p.gender === "unknown");
}