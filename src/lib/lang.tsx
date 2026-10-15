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
  soonTitleClients: ["Macaamiisha", "Clients"],
  soonTitlePayments: ["Lacagaha", "Payments"],
  soonTitleReports: ["Warbixinada", "Reports"],
  soonTitleSettings: ["Habayn", "Settings"],

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
