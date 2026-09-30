/**
 * Phase Revision — UI labels (Somali primary, multilingual-ready).
 *
 * Every user-visible string added by the revision lives here as
 * label_so/label_en so a future locale switch needs no code changes.
 * Existing config-driven labels (DocumentConfig) remain the source for
 * section/field/party names.
 */

export type Locale = "so" | "en";

export interface L10n {
  so: string;
  en?: string;
}

/** Resolve a localized string (Somali primary, English optional). */
export function t(value: L10n, locale: Locale = "so"): string {
  if (locale === "en" && value.en) return value.en;
  return value.so;
}

/* ------------------------------------------------------------------ */
/* Interview shell                                                     */
/* ------------------------------------------------------------------ */

export const UI = {
  appTitle: { so: "DPN NOTARY", en: "DPN NOTARY" },
  back: { so: "Dib", en: "Back" },
  continue: { so: "Sii wad", en: "Continue" },
  review: { so: "Dib u Eegis", en: "Review" },
  reviewAndGenerate: { so: "Dib u Eegis & Abuur", en: "Review & Generate" },
  generate: { so: "Abuur Dukumeenti", en: "Generate document" },
  generating: { so: "La abuurayo…", en: "Generating…" },
  saveDraft: { so: "Kaydi Draft", en: "Save draft" },
  saving: { so: "La kaydinayo…", en: "Saving…" },
  draftSaved: { so: "La kaydiyay ✓", en: "Draft saved ✓" },
  savingDraft: { so: "La kaydinayo…", en: "Saving…" },
  step: { so: "Tallaabada", en: "Step" },
  of: { so: "ka", en: "of" },
  index: { so: "Tusmada", en: "Index" },
  fixErrors: {
    so: "Waxaa jira xog aan dhammaystirnayn. Fadlan sax meelaha lagu calaamadeeyay.",
    en: "Some answers are incomplete. Please fix the highlighted fields.",
  },
  completedBadge: { so: "La dhammaystiray", en: "Completed" },
  goToStep: { so: "U gudub tallaabada", en: "Go to step" },
} as const;

/* ------------------------------------------------------------------ */
/* Count-first number selector                                         */
/* ------------------------------------------------------------------ */

export const COUNT = {
  howMany: (singular: L10n, count: number): L10n => ({
    so: `Imisa ${singular.so} ayaa heshiiska ku jira?`,
    en: `How many ${singular.en ?? singular.so}s are in this contract?`,
  }),
  selected: (singular: L10n, count: number): L10n => ({
    so: `${count} ${singular.so} la doortay`,
    en: `${count} ${singular.en ?? singular.so} selected`,
  }),
  rowsCreated: (singular: L10n, count: number): L10n => ({
    so: `${count} ${singular.so} waa la abuuray — buuxi xogta hoostooda.`,
    en: `${count} ${singular.en ?? singular.so} created — fill in their details below.`,
  }),
  decrease: { so: "Yar", en: "Decrease" },
  increase: { so: "Bar", en: "Increase" },
  minOne: { so: "Ugu yaraan 1 waa loo baahan yahay.", en: "At least 1 is required." },
} as const;

/* ------------------------------------------------------------------ */
/* Attendance & representatives                                        */
/* ------------------------------------------------------------------ */

export const ATTENDANCE_UI = {
  title: { so: "Xaaladda Xubnaha", en: "Party attendance" },
  description: {
    so: "Xubin kasta si gaar ah loo weydii — Jooga, Ma Joogo, ama Wakiil ayaa matalaya.",
    en: "Ask each party individually — Present, Absent, or Represented.",
  },
  chooseStatus: { so: "Xaaladda", en: "Attendance" },
  representedBy: { so: "Wakiilka matalaya", en: "Represented by" },
  chooseRep: { so: "Dooro Wakiil", en: "Choose representative" },
  newRep: { so: "Samee Wakiil Cusub", en: "New representative" },
  repDetails: { so: "Xogta Wakiilka", en: "Representative details" },
  representing: { so: "Matalaya", en: "Representing" },
  noReps: {
    so: "Weli wakiil lama abuurin — dooro \"Samee Wakiil Cusub\".",
    en: "No representative yet — create one below.",
  },
  linkParty: { so: "Matalaya:", en: "Represents:" },
  removeRep: { so: "Tirtir wakiilka", en: "Remove representative" },
  unlinked: {
    so: "Weli xisbi la xiriirin — dooro xubin xiriirisa.",
    en: "Not linked to a party yet.",
  },
  addPartyToRep: {
    so: "Ku dar xubin wakiilkan",
    en: "Link a party to this rep",
  },
} as const;

/* ------------------------------------------------------------------ */
/* Generic                                                             */
/* ------------------------------------------------------------------ */

export const COMMON = {
  remove: { so: "Tirtir", en: "Remove" },
  removeConfirm: { so: "Xaqiiji tirtirida", en: "Confirm removal" },
  removeQuestion: (name: string): L10n => ({
    so: `Ma tirtirayn doontaa ${name}? Xogta la geliyay qaybtan waa la baabi'inayaa.`,
    en: `Remove ${name}? The entered data will be deleted.`,
  }),
  yesRemove: { so: "Haa, tirtir", en: "Yes, remove" },
  cancel: { so: "Jooji", en: "Cancel" },
  registered: (count: number): L10n => ({
    so: `${count} la diiwaangeliyay`,
    en: `${count} registered`,
  }),
} as const;
