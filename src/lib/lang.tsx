/**
 * LUQADDA NIDAAMKA — one language at a time, SO (default) or EN.
 *
 * A single toggle at the top of the shell switches EVERY rebuilt page.
 * The dictionary holds only interface copy; data (references, names,
 * dates) always renders exactly as stored, never translated.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "so" | "en";

const STORAGE_KEY = "notary.lang.";
const DEFAULT_LANG: Lang = "so";

function readStoredLang(): Lang {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw === "en" ? "en" : DEFAULT_LANG;
  } catch {
    // Locked-down browser: the system stays in its default language.
    return DEFAULT_LANG;
  }
}

function storeLang(lang: Lang): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    // Private browsing: the choice lives for this session only.
  }
}

type Dict = Record<string, [string, string]>; // [so, en]

/** The interface copy. One entry per key; `[Somali, English]`. */
const DICT: Dict = {
  // Nav tabs + shell
  tabDocuments: ["Dukumentiyada", "Documents"],
  tabClients: ["Macaamiisha", "Clients"],
  tabPayments: ["Lacagaha", "Payments"],
  tabReports: ["Warbixinada", "Reports"],
  tabSettings: ["Habayn", "Settings"],
  newDocument: ["Dukumenti cusub", "New document"],
  newClient: ["Macmiil cusub", "New client"],
  newPayment: ["Lacag cusub", "New payment"],
  exportCsv: ["Soo degso CSV", "Download CSV"],
  notYetRebuilt: ["Bogga hore weli waa dib loo dhisayaa.", "This page is being rebuilt."],

  // Documents page
  docTitle: ["Dukumentiyada", "Documents"],
  docSub: [
    "Dhammaan dukumentiyada xafiiska — kaydka, raadinka iyo xaqiijinta.",
    "Every office document — the archive, search and verification.",
  ],
  statDocs: ["Dukumentiyada", "Documents"],
  statPending: ["Sugaya", "Pending"],
  statIncome: ["Dakhli", "Income"],
  statVerified: ["La xaqiijiyay", "Verified"],
  searchPlaceholder: ["Raadi tixraac, magac, ama nooc…", "Search reference, name, or type…"],
  filterAll: ["Dhammaan", "All"],
  filterDraft: ["Qabyo", "Drafts"],
  statusDraft: ["Qabyo", "Draft"],
  statusPending: ["Sugaya", "Pending"],
  statusVerified: ["La xaqiijiyay", "Verified"],
  docEmpty: ["Ma jiro dukumenti.", "No documents."],
  docEmptyHint: ["Taab 'Dukumenti cusub' si aad u bilowdo.", "Tap 'New document' to start one."],
  noSearchMatch: ["Lama helin raadinka.", "Nothing found."],
  verifyTitle: ["Xaqiiji QR / Tixraac", "Verify QR / Reference"],
  verifyPlaceholder: ["DPN/K/001", "DPN/K/001"],
  verifyGo: ["Xaqiiji", "Verify"],
  verifyFound: ["La xaqiijiyay — dukumentigu jiraa.", "Verified — the document exists."],
  verifyNotFound: ["Tixraaca lama helin kaydka.", "Reference not in the archive."],
  verifyIdledHint: [
    "Geli tixraaca dukumintiga (tusaale: DPN/K/001).",
    "Enter the reference printed on the document (e.g. DPN/K/001).",
  ],
  partiesCount: ["qof", "people"],

  // Clients page (Macaamiisha)
  clientTitle: ["Macaamiisha", "Clients"],
  clientSub: [
    "Saxiixayaasha iyo lababka ku jira dukumintiyada — qofka, xafladaha, diiwaanada saxiixka iyo dhammaanka.",
    "Signers and parties from the office documents. Cards: people, groups, records, documents.",
  ],
  statPeople: ["Qof", "People"],
  statGroups: ["Kooxo / Qoys", "Groups"],
  statRoleRecords: ["Diiwaanada", "Records"],
  clientSearchPlaceholder: ["Raadi magac, telefoon ama tixraac…", "Search name, phone or reference…"],
  clientEmpty: ["Ma jiro macmiil.", "No clients."],
  clientEmptyHint: [
    "Macmiilku waa saxiixihii ku dhisay dukumintiyada xafiiska.",
    "Clients are derived from the documents — create a document to record one.",
  ],
  noClientSearchMatch: ["Lama helin raadinka.", "Nothing found."],
  groupBadge: ["Koox", "Group"],

  // Payments page (Lacagaha)
  payTitle: ["Lacagaha", "Payments"],
  paySub: [
    "Lacagta dukumintiyadu qabtaan iyo diiwaanka bixineed ee xafiiska.",
    "The money the documents hold and the office's payment ledger.",
  ],
  payRecorded: ["Diiwaanada", "Records"],
  payDocsWithMoney: ["Dukumi lacag leh", "Docs with money"],
  payDocsTotal: ["Dukumentiyada", "Documents"],
  payRecordTitle: ["Diiwaan geli bixinta", "Record a payment"],
  payRecordHint: [
    "Bixintu waxay galaysaa jaadka Lacagaha — Dakhli oo bogga hore aayaa iskaga warqada.",
    "Payments go into the real ledger — the front page's Dakhli reads it.",
  ],
  payPickDoc: ["Dukumentos leh lacag", "A document with money"],
  payAmountPlaceholder: ["Tusaale: 600", "e.g. 600"],
  payNotesPlaceholder: ["Faahfaahin dheeraad ah…", "Notes…"],
  payRecord: ["Kaydi", "Save"],
  payBadAmount: ["Gali tirba lacag sax ah.", "Enter a valid amount."],
  paySaved: ["La kaydiyay diiwaanka.", "Recorded in the ledger."],
  paySaveFailed: ["Lama kaydin — isku day mar kale.", "Could not save — try again."],
  payLedgerEmpty: ["Diiwaanka lacagta wuu madhan yahay.", "The ledger is empty."],
  payLedgerEmptyHint: [
    "Bixi lacag diiwaan geli maqaamka kor u kac.",
    "Record a payment above to start it.",
  ],
  payTotal: ["Qiimaha", "Total"],
  payBalance: ["Baaqiga", "Balance"],
  payNoDocMoney: [
    "Dukumintiyadu weli ma haystaan jawaab lacageed.",
    "No document holds a money answer yet.",
  ],

  // Reports page (Warbixinada)
  repTitle: ["Warbixinada", "Reports"],
  repSub: [
    "Tirakoobyada dhabta ah: noocasta, bishii, iyo CSV dukumintiyada.",
    "Real aggregates: by type, by month, and a CSV of the archive.",
  ],
  repByType: ["Noocasta", "By document type"],
  repByMonth: ["Bishii", "By month"],
  repMonthDocs: ["Dukumi la dhammeeyay", "Documents finished"],
  repEmpty: [
    "Weli wax lama diiwaan geliyin — abuur dukumenti.",
    "Nothing recorded yet — create a document.",
  ],

  // Settings page (Habayn)
  setSub: [
    "Xogta xafiiska, offline, backup iyo doorashooyinka export-ka.",
    "Office details, offline mode, backup and export choices.",
  ],
  setOffSection: ["Xogta Xafiiska", "Office details"],
  setOffHint: [
    "Waxa halkan qorto waa wixii dukumintigu daabacayo — waxba lama abuuro.",
    "Everything typed here is what the documents print — nothing is invented.",
  ],
  setOfficeName: ["Magaca Xafiiska", "Office name"],
  setOfficeAddress: ["Cinwaan", "Address"],
  setOfficePhone: ["Telefoon", "Phone"],
  setOfficeExtra: ["Khad kale (iimayl iwm.)", "Extra line (email etc.)"],
  setExpSection: ["Export & Eegis", "Export & review"],
  setExpHint: [
    "Magaca faylka waa Reference_DocumentType. Qaabka taariikhda halkan ayaa lagu dooroartaa.",
    "Files are named Reference_DocumentType. The date format is chosen here.",
  ],
  setDateFormat: ["Qaabka taariikhda", "Date format"],
  setPreview: ["Sida madaxu u eegi doono", "Header preview"],
  setPreviewEmpty: [
    "Madaxani waa madhan — qor magaca xafiiska si uu u muuqdo.",
    "The header is empty — type an office name to see it.",
  ],
  setOfflineTitle: ["Mode-ka Offline", "Offline mode"],
  setOfflineOn: [
    "Waa la shaqeeyaa. Databaasku, template-yadu, search-ku, drafts-ku iyo files-ku waxay ku jiraan computer-kaan oo keliya — internet la'aanba wax walba way shaqeynayaan.",
    "It is running. The database, templates, search, drafts and files live on this computer only — everything works without internet.",
  ],
  setOfflineOff: [
    "Waa la damay — nidaamku walaan ku shaqeynayaa qortiwaarka.",
    "It is off — the system is working as usual.",
  ],
  setOfflineBtnOff: ["Dami", "Turn off"],
  setOfflineBtnOn: ["Fur", "Turn on"],
  setToastOffOn: [
    "Hab offline ayaa shaqeynaya — wax walba waxay ku shaqaan computer-kaan.",
    "Offline mode is on — everything stays on this computer.",
  ],
  setToastOffOff: ["Hab offline waa la damiyay.", "Offline mode turned off."],
  setSaved: ["Habayntu waa la kaydiyay.", "Settings saved."],
  setSave: ["Kaydi", "Save"],
  setReset: ["Soo celi", "Reset"],
  setManageTemplates: ["Maaree template-yada →", "Manage templates →"],
};

export interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** `t("key")` → the string in the active language. Unknown keys pass through. */
  t: (key: keyof typeof DICT | string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => undefined,
  t: (key) => String(key),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  useEffect(() => {
    document.documentElement.lang = lang === "so" ? "so" : "en";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    storeLang(next);
  }, []);

  const t = useCallback(
    (key: string) => {
      const entry = DICT[key];
      if (!entry) return key;
      return lang === "en" ? entry[1] : entry[0];
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}
