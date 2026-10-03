/**
 * KALA IIBSI HANTI — REVIEW.
 *
 * The review is the last thing the notary reads before the document is
 * signed, so it has to answer, at a glance, the questions the office asked
 * for — not "here is every form field in the order you typed them":
 *
 *   how many sellers · which groups · who represents whom · how many
 *   photographs and whose · who signs · how many buyers · how many
 *   witnesses · the property · the money · and WHAT IS STILL MISSING
 *
 * Two rules shape it:
 *
 *   1. A MISSING OPTIONAL field is not a problem. It simply does not
 *      appear, and it never blocks the document.
 *   2. A MISSING REQUIRED field is reported explicitly, by name, so the
 *      notary sees the gap rather than discovering it in the .docx.
 *
 * Pure: it reads the config and the answers and returns data. Nothing here
 * writes, generates or mutates, so it can be rendered anywhere and tested
 * without a browser.
 */

import type { DocumentConfig, FormValues, PartyRow } from "./types";
import { validateDocument } from "./validation";
import { HANTI_KEYS, buildHantiPartyModel } from "./hantiParties";
import {
  genderWord,
  representedPeople,
  type PartyModel,
  type Person,
} from "./partyModel";

/** One readable answer on the review. */
export interface ReviewLine {
  label: string;
  value: string;
}

/** One titled group of answers. */
export interface ReviewBlock {
  key: string;
  title: string;
  /** A count line rendered under the title ("Tirada: 13"), when the office
   *  asked for one. Never a requirement — only what was actually entered. */
  count?: string;
  lines: ReviewLine[];
}

/** A REQUIRED answer that is still blank. */
export interface ReviewMissing {
  /** Form path, e.g. "hantida_dhul_banaan.degmada". */
  path: string;
  message: string;
}

export interface HantiReview {
  blocks: ReviewBlock[];
  /** Required answers still blank. Empty means the document may be signed. */
  missing: ReviewMissing[];
  /** True when nothing required is outstanding — optional gaps do not count. */
  ready: boolean;
}

/* ------------------------------------------------------------------ */
/* Small readers                                                       */
/* ------------------------------------------------------------------ */

function sectionValue(values: FormValues, sectionId: string): Record<string, string> {
  const v = values[sectionId];
  return v && !Array.isArray(v) ? (v as Record<string, string>) : {};
}

function rowsOf(values: FormValues, key: string): PartyRow[] {
  const v = values[key];
  return Array.isArray(v) ? (v as PartyRow[]) : [];
}

/** A row counts as filled when any of its values carries text. */
function filled(rows: PartyRow[]): PartyRow[] {
  return rows.filter((r) =>
    Object.values(r.values ?? {}).some((v) => (v ?? "").trim() !== ""),
  );
}

const text = (row: PartyRow | undefined, field: string): string =>
  (row?.values?.[field] ?? "").trim();

/** "Ruun, Ibraahin, Farax (4)" — who a representative stands for. */
function coversLabel(model: PartyModel, representativeId: string): string {
  const people = model.representations
    .filter((r) => r.representativeId === representativeId)
    .flatMap((r) => representedPeople(model, r).map((p) => p.name));
  const names = [...new Set(people)];
  return names.length ? `${names.join(", ")} (${names.length})` : "—";
}

/**
 * The legal word describing a person, when their gender has been chosen.
 *
 * Returns "" when it has not — never a guess. The review then shows the
 * name alone and the notary can see the gender still has to be picked.
 */
function wordFor(person: Person, role: "seller" | "buyer"): string {
  return genderWord({ role, gender: person.gender, number: "singular" }) ?? "";
}

/* ------------------------------------------------------------------ */
/* The review                                                          */
/* ------------------------------------------------------------------ */

/**
 * Build the review for one Kala Iibsi Hanti document.
 *
 * `model` may be supplied by a caller that has already built it; otherwise
 * it is derived from the answers.
 */
export function buildHantiReview(
  config: DocumentConfig,
  values: FormValues,
  model: PartyModel = buildHantiPartyModel(values),
): HantiReview {
  const blocks: ReviewBlock[] = [];

  /* ---- SELLERS -------------------------------------------------- */
  const sellerRows = filled(rowsOf(values, HANTI_KEYS.sellers));
  const sellerNames = sellerRows.map((r) => text(r, "magac"));
  blocks.push({
    key: "sellers",
    title: "Iibiyayaasha",
    count: `Tirada: ${sellerNames.length}`,
    lines: sellerNames.map((name, i) => {
      const p = model.people.find((x) => x.name === name);
      const word = p ? wordFor(p, "seller") : "";
      return {
        label: `Iibiyaha ${i + 1}`,
        // Gender, when known, is shown as the LEGAL WORD it produces — so a
        // missing gender is visible here as an absence, not as a blank cell.
        value: word ? `${name} — ${word}` : name,
      };
    }),
  });

  /* ---- GROUPS --------------------------------------------------- */
  if (model.groups.length > 0) {
    blocks.push({
      key: "groups",
      title: "Kooxaha / Qoysku",
      count: `Tirada: ${model.groups.length}`,
      lines: model.groups.map((g) => ({
        label: g.name,
        value: `${g.memberIds.length} xubin`,
      })),
    });
  }

  /* ---- REPRESENTATIVES ------------------------------------------ */
  if (model.representations.length > 0) {
    blocks.push({
      key: "representatives",
      title: "Wakiillada",
      count: `Tirada: ${model.representations.length}`,
      lines: model.representations.map((r) => {
        const rep = model.people.find((p) => p.id === r.representativeId);
        const type =
          r.type === "wakiil_qayim" ? "Wakiil Qayim" : "Wakiil caadi ah";
        return {
          label: rep?.name ?? r.representativeId,
          // "who" and "for whom" are the two halves of one authority.
          value: `${type} — matalaysaa: ${coversLabel(model, r.representativeId)}${
            r.reference ? ` · ${r.reference}` : ""
          }`,
        };
      }),
    });
  }

  /* ---- PHOTOS --------------------------------------------------- */
  if (model.photos.length > 0) {
    blocks.push({
      key: "photos",
      title: "Sawirrada",
      count: `Tirada: ${model.photos.length}`,
      lines: model.photos.map((photo, i) => ({
        label: `Sawir ${i + 1}`,
        value: model.people.find((p) => p.id === photo.personId)?.name ?? "—",
      })),
    });
  }

  /* ---- SIGNATORIES ---------------------------------------------- */
  if (model.signatures.length > 0) {
    blocks.push({
      key: "signatories",
      title: "Saxeexayaasha",
      count: `Tirada: ${model.signatures.length}`,
      lines: model.signatures.map((s, i) => ({
        label: `Saxeex ${i + 1}`,
        value: `${s.prefix ? `${s.prefix} ` : ""}${
          model.people.find((p) => p.id === s.personId)?.name ?? "—"
        }`,
      })),
    });
  }

  /* ---- BUYERS ---------------------------------------------------- */
  const buyerRows = filled(rowsOf(values, HANTI_KEYS.buyers));
  if (buyerRows.length > 0) {
    blocks.push({
      key: "buyers",
      title: "Iibsadayaasha",
      count: `Tirada: ${buyerRows.length}`,
      lines: buyerRows.map((r, i) => {
        const p = model.people.find((x) => x.name === text(r, "magac"));
        const word = p ? wordFor(p, "buyer") : "";
        return { label: `Iibsade ${i + 1}`, value: word ? `${text(r, "magac")} — ${word}` : text(r, "magac") };
      }),
    });
  }

  /* ---- WITNESSES ------------------------------------------------- */
  const witnessRows = filled(rowsOf(values, HANTI_KEYS.witnesses));
  blocks.push({
    key: "witnesses",
    title: "Maragyada",
    count: `Tirada: ${witnessRows.length}`,
    lines: witnessRows.map((r, i) => ({
      label: `Marag ${i + 1}`,
      value: text(r, "magac"),
    })),
  });

  /* ---- PROPERTY — the matching sub-type only ---------------------- */
  const subType = sectionValue(values, config.setupSectionId ?? "dejinta").sub_type;
  const propertySection = config.sections.find((s) => s.id === `hantida_${subType}`);
  if (propertySection) {
    const sectionVals = sectionValue(values, propertySection.id);
    blocks.push({
      key: "property",
      title: `Hantida (${config.subTypes.find((s) => s.value === subType)?.label ?? subType})`,
      lines: propertySection.fields
        .map((f) => ({
          label: f.label,
          value: (sectionVals[f.id] ?? "").trim(),
        }))
        // An OPTIONAL property field the notary skipped simply does not print.
        .filter((l) => l.value !== ""),
    });
  }

  /* ---- CERTIFICATES ---------------------------------------------- */
  if (model.certificates.length > 0) {
    blocks.push({
      key: "certificates",
      title: "Shaxadaha / References",
      count: `Tirada: ${model.certificates.length}`,
      lines: model.certificates.map((c) => ({
        label: c.reference,
        value: [
          c.kind,
          c.aboutPersonId
            ? model.people.find((p) => p.id === c.aboutPersonId)?.name
            : c.aboutGroupId
              ? model.groups.find((g) => g.id === c.aboutGroupId)?.name
              : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    });
  }

  /* ---- PAYMENT ---------------------------------------------------- */
  const price = sectionValue(values, "qiimaha");
  const paid = (price.lacagta_bixiyay ?? "").trim();
  blocks.push({
    key: "payment",
    title: "Qiimaha & Lacag-bixinta",
    lines: [
      { label: "Qiimaha Guud", value: price.qiimaha_guud ?? "" },
      ...(paid ? [{ label: "Lacagta la bixiyay", value: paid }] : []),
    ].filter((l) => l.value !== ""),
  });

  /* ---- WHAT IS STILL MISSING (required only) ---------------------- */
  const missing: ReviewMissing[] = [];
  for (const [sectionId, result] of Object.entries(validateDocument(config, values))) {
    for (const [fieldId, message] of Object.entries(result.fieldErrors ?? {})) {
      missing.push({ path: `${sectionId}.${fieldId}`, message });
    }
    // partyErrors is keyed by party id, each holding the per-row failures.
    for (const rows of Object.values(result.partyErrors ?? {})) {
      for (const row of rows) {
        for (const err of row.errors) {
          missing.push({
            path: `${sectionId}[${row.index}].${err.fieldId}`,
            message: err.message,
          });
        }
      }
    }
    for (const message of result.general ?? []) {
      missing.push({ path: sectionId, message });
    }
  }

  return { blocks, missing, ready: missing.length === 0 };
}