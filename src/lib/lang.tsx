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

  // Backup & Restore (Habayn)
  bkTitle: ["Backup & Restore", "Backup & Restore"],
  bkIntro: [
    "Nidaamku waa offline — database-ku, template-yadu iyo dukumeentiguba waxay ku jiraan computer-kan oo keliya. Halkan ayaad nuqul ka soo saari kartaa: hal fayl oo la yidhaahda ",
    "The system is offline — the database, templates and documents live on this computer only. You can take a copy from here: one file named ",
  ],
  bkIntroTail: [
    ", oo ku jira dhammaan heshiisyada, drafts, tixraacyada, settings-ka iyo template-yada la beddelay.",
    ", carrying every agreement, draft, reference counter, setting and uploaded template.",
  ],
  bkLocalCount: [
    "Haddii computerkaan lumiyo: ",
    "If this computer is lost: ",
  ],
  bkDocsLocal: [
    " dukumenti ayaa maxalli jira.",
    " documents exist only here.",
  ],
  bkBtnBackup: ["Backup Database", "Backup database"],
  bkBtnRestore: ["Soo celi Backup", "Restore backup"],
  bkMade: ["waa la soo saaray", "was created"],
  bkNHyshiis: ["heshiis", "agreements"],
  bkNDrafts: ["qabyo", "drafts"],
  bkNTemplates: ["template", "templates"],
  bkToastBackupFail: [
    "Backup-ku lama sameeyn karin — isku day mar kale.",
    "Backup failed — try again.",
  ],
  bkToastFileFail: ["Faylka lama akhrin karo.", "The file could not be read."],
  bkToastReplaceOk: [
    "Xogtu waa la beddelay — hadda waxay la eg tahay backup-ka.",
    "Data replaced — it now matches the backup.",
  ],
  bkRestored: ["la soo geliyay", "restored"],
  bkToastRestoreFail: [
    "Restore-ku lama fulin karin — xogtaada waxba ma isbeddelin.",
    "Restore failed — your data is unchanged.",
  ],
  bkDialogTitle: ["Soo celidda backup-ka", "Restore backup"],
  bkDialogIntro: ["Faylkan waxaa ku jira (", "This file holds ("],
  bkDialogClose: [
    "):",
    "):",
  ],
  bkMergeDesc: [
    "Merge — waxa jira waa la ilaaliyaa; waxa faylku qabo ayaa la daraa. Tan waa doorashada badbaadada leh.",
    "Merge — what exists is kept; what the file carries is added. This is the safe choice.",
  ],
  bkReplaceDesc: [
    "Beddel — databaseka waa la joojin doonaa waxa hadda jir oo backup-ka aan ku jirin baaba'doona si buuxda. Ee fiirso ka hor intaad dhaqaajiso.",
    "Replace — the database is emptied. Anything not in the backup is gone for good. Make sure you want this.",
  ],
  bkBtnMerge: ["Merge", "Merge"],
  bkBtnReplace: ["Ku beddel xogta dhammaan", "Replace everything"],
  bkCancel: ["Jooji", "Cancel"],
  bkAria: ["Backup iyo Restore", "Backup and restore"],

  // Template Manager page (Templates)
  tplTitle: ["Template Manager", "Template Manager"],
  tplSub: [
    "Word template-yadaada — adigaa wareejiya qaab-dhismeedka.",
    "Your Word templates — you own the design.",
  ],
  tplDocType: ["Nooca Dukumeentiga", "Document type"],
  tplUploadTitle: ["Soo geli Word Template (.docx)", "Upload a Word template (.docx)"],
  tplUploadHintA: [
    "Template-ka waa iska leh USER-KA: qaabka, font-ka, logo-ga, sharciga iyo saxiixada — dhammaan waxay ku jiraan faylkaaga. System-ku wuxuu kaliya akhriyaa placeholder-yada ",
    "You own the template: the layout, font, logo, legal text and signatures all live in your file. The system only reads the ",
  ],
  tplUploadHintB: [
    " oo xogta buuxinayaa.",
    " placeholders and fills in the data.",
  ],
  tplChooseFile: ["Dooro .docx", "Choose .docx"],
  tplDontBreak: ["haba seyn", "must not be broken"],
  tplDl: ["Soo celi", "Download"],

  // Compatibility report
  tplReportOk: [
    "Template-ku waafaqaa nidaamka — document-ka waa la buuxin karaa.",
    "The template matches the system — the document can be generated.",
  ],
  tplReportBad: [
    "Template-ku ma waafaqno nidaamka — qaladahan la saxo template-ka.",
    "The template does not match the system — fix these errors in the template.",
  ],
  tplStructErrors: ["Qalado qaab-dhismeed ah:", "Structural problems:"],
  tplUnknownWarnA: [
    "⚠ Template-ku wuxuu leeyahay placeholder aan system-ku aqoon: ",
    "⚠ The template carries placeholders the system does not know: ",
  ],
  tplUnknownWarnB: [
    " — generation ma joojinayo, token-kii ayaa document-ka ka saaraysa.",
    " — generation will not stop; the token is stripped from the document.",
  ],
  tplAliases: [
    "Magacyo duub ah oo hadda la heli karo:",
    "Old names that still resolve:",
  ],
  tplRecognized: ["La aqoonsan", "Recognized"],
  tplAlias: ["Alias", "Alias"],
  tplUnknown: ["Ma aqoon", "Unknown"],
  tplUnused: ["Isticmaal ma san", "Unused"],
  tplUnusedSummaryA: [
    "Magacyo system-ku yaqaan laakiin template-ku isticmaali maaha (",
    "Names the system knows that this template does not use (",
  ],
  tplUnusedHint: [
    "Tan waa xoog gaar ah oo aad qaad karo: haddii aad u isticmaasho, template-ka ayaa la buuxinayaa. ",
    "Free power you can claim: use them and the template fills them in. ",
  ],

  // Starter downloads
  tplV1Title: ["Template-ka nidaamka v1 (miis xog leh)", "System template v1 (data tables)"],
  tplV1HintA: [
    "System-ku wuxuu abuuraa Word .docx template-ka La ",
    "The system builds the ",
  ],
  tplV1HintB: [
    " oo leh placeholder-yada canonical-ka. Ka dibna ADIGA ayaa Word-ka furaya, qaabka, font-ka, logo-ga, sharciga iyo meelaha saxiixada aad beddelaysaa — placeholder-yadana ",
    " Word file with the canonical placeholders. You then open it in Word and change the layout, font, logo, legal text and signature spots — the placeholders ",
  ],
  tplV1Tail: [
    "Marka aad Word-ka ku edit-gareeyo, ku kaydi magac cusub (tusaale ",
    "After editing in Word, save it under a new name (e.g. ",
  ],
  tplV1TailB: [
    ") oo soo geli Template Manager-ka — user-kayga waa la ilaaliyaa, lama beddelin.",
    ") and upload it here — your copy is preserved, never replaced.",
  ],
  tplToastStarterOk: [
    "Template-ka nidaamka waa la soo celiyay — furi Word-ka si aad u edisto.",
    "The system template was downloaded — open Word to edit it.",
  ],
  tplToastV2Ok: [
    "Template-ka v2 waa la soo celiyay — qodobado sharciyeed buuxa.",
    "The v2 template was downloaded — full legal clauses.",
  ],

  // v2 card
  tplV2Title: ["Template-ka v2 — Heshiis Kiro (qoraal sharciyeed)", "Template v2 — rental contract (legal text)"],
  tplV2Badge: ["WAA LA TAAGEERAA", "SUPPORTED"],
  tplV2HintA: [
    "Waa ",
    "It is ",
  ],
  tplV2HintB: [
    "token-yada canonical-ka, oo la ilaaliyo.",
    " canonical tokens, preserved as-is.",
  ],
  tplV2Tail: [
    "Furi Word-ka, qaab-dhismeedka, font-ka, logo-ga, sharciga iyo meelaha saxiixada adigaa beddelaysaa — placeholder-yadana ",
    "Open Word and change the layout, font, logo, legal text and signature spots — the placeholders ",
  ],

  // Hanti card
  tplHantiTitle: ["Template-yada xafiiska — Kala Iibsi Hanti", "Office templates — property transfer"],
  tplHantiBadge: ["QORAALKA XAFIISKA OO DHAN", "THE OFFICE'S OWN WORDING"],
  tplHantiHint: [
    "Kuwani waa template-yada xafiiska oo dhab ah — waxba lama abuurin, waxba lama beddelin. Soo deji faylka nooca aad doorbido, furi Word-ka, u samee edit gaar ah (placeholder-yada ",
    "These are the office's real templates — nothing invented, nothing altered. Download the one you want, open Word, edit it (the ",
  ],
  tplHantiHintB: [
    "), ka dibna kor ku soo geli Template Manager-ka si uu document-yada cusub laga abuuro.",
    " placeholders ",
  ],
  tplHantiTail: [
    "\"Hanti Kale\" ma laha template (waa go'aan furan — marka sawiradda scan-keeda la keeno, faylkeeda oo keliya ayaa halkan lagu daraa).",
    "\"Other property\" has no template (an open decision — when its scan arrives, only its file will be added here).",
  ],
  tplHantiMid: [
    " waa la soo celiyay — furi Word-ka si aad u edisto.",
    " was downloaded — open Word to edit it.",
  ],

  // Cilaaj card
  tplCilaajTitle: ["Template-ka xafiiska — Cadayn Cilaaj", "Office template — patient referral note"],
  tplCilaajBadge: ["QORAALKA XAFIISKA (SCAN OO DHAN)", "THE OFFICE'S WORDING (FULL SCAN)"],
  tplCilaajHint: [
    "Waa dukumenti xafiiska — \"Cadayn Masuuliyad Qaadis Bukaan\" (Ref/Dpn/CC/…). Soo deji faylka, furi Word-ka, u samee edit gaar ah (placeholder-yada ",
    "An office document — the referral note (Ref/Dpn/CC/…). Download the file, open Word, edit it (the ",
  ],
  tplCilaajHintB: [
    "), ka dibna kor ku soo geli Template Manager-ka si document-yada cusub laga abuuro.",
    " placeholders must survive) and upload it here so new documents use it.",
  ],
  tplCilaajTail: [
    "Marka aad Word-ka ku edit-gareeyo, ku kaydi (ama magac cusub) oo soo geli kore — record cusub ayaa la abuuraa, tii hore luma dumin.",
    "After editing in Word, save it and upload it above — a new record is created; the old one is not deleted.",
  ],

  // Upload + list + toasts
  tplToastCilaajOk: [
    "Template-ka Cadayn Cilaaj waa la soo celiyay — furi Word-ka si aad u edisto.",
    "The referral-note template was downloaded — open Word to edit it.",
  ],
  tplToastStarterFail: [
    "Template-ka lama soo celin karo — isku day mar kale.",
    "The template could not be downloaded — try again.",
  ],
  tplToastOnlyDocx: [
    "Kaliya faylasha Word (.docx) ayaa la oggol yahay.",
    "Only Word (.docx) files are allowed.",
  ],
  tplUnknownStored: ["Placeholder aan la aqoon: {{", "Unknown placeholder: {{"],
  tplToastUploadOk: [
    "Template-ka waa la soo geliyay oo la kaydiyay (maxalli ah).",
    "The template was uploaded and stored locally.",
  ],
  tplToastUploadFail: [
    "Soo gelidda template-ka wuu fashilmay — isku day mar kale.",
    "The upload failed — try again.",
  ],
  tplPlaceholdersA: ["Placeholder-yada la heli karo (", "Available placeholders ("],
  tplRepeatBlocks: ["Repeat blocks: ", "Repeat blocks: "],
  tplConditionals: ["Conditionals: ", "Conditionals: "],
  tplListEmpty: [
    "Weli template lama soo gelin. Soo geli .docx aad sameysay si aad u isticmaasho generation-ka.",
    "No template uploaded yet. Upload a .docx you have made to use it for generation.",
  ],
  tplDefault: ["Default", "Default"],
  tplSetDefaultOk: ["Template-ka default waa loo dhigay.", "Set as the default template."],
  tplSetDefaultFail: ["Lama dhejin karo — isku day mar kale.", "Could not set it — try again."],
  tplDelete: ["Tirtir", "Delete"],
  tplDeleteOk: ["Template-ka waa la tirtiray.", "The template was deleted."],
  tplDeleteFail: ["Lama tirtirin — isku day mar kale.", "Could not delete — try again."],
  tplWarnCount: [" warning: ", " warning: "],
  tplFooter: [
    "Template-yada hore lama beddelo oo lama overwrite-gareyn — mar kasta oo aad soo gelisid, record cusub ayaa la abuuraa.",
    "Earlier templates are never altered or overwritten — every upload creates a new record.",
  ],
  tplBackLink: ["← Dashboard", "← Dashboard"],

  // Admin page
  admSub: [
    "Muuqaal guud oo xafiiska — dukumintiyada, ballannada, qoraallada guddiga iyo faallooyinka.",
    "Workspace-wide overview — documents, bookings, board posts and comments.",
  ],
  admStatDocuments: ["Dukumintiyada", "Documents"],
  admGenerated: ["la soo saaray", "generated"],
  admDrafts: ["qabyo", "drafts"],
  admStatAppointments: ["Ballannada", "Appointments"],
  admUpcoming: ["weli imaneysa", "upcoming"],
  admStatPosts: ["Qoraallada guddiga", "Board posts"],
  admStatTypes: ["Nooc firfircoon", "Types live"],
  admPlanned: ["la qorsheeyay", "planned"],
  admValidation: ["Xaqiijinta template-ka", "Template validation"],
  admValidationHint: [
    "Hubi in template-ka Word uu sax yahay ka hor generation: placeholders syntax, mappings la heli karo, IF/ENDIF iyo BLOCK markers balanced. Xog tijaabo ah ayaa la isticmaalaa — wax lama kaydin.",
    "Check the Word template before generation: placeholder syntax, resolvable mappings, balanced IF/ENDIF and BLOCK markers. Sample data is used — nothing is stored.",
  ],
  admPickPlaceholder: ["Dooro template…", "Choose a template…"],
  admValidating: ["Hubinaya…", "Validating…"],
  admValidateBtn: ["Hubi template-ka", "Validate template"],
  admValidOk: ["Sax — diyaar", "OK — ready"],
  admValidBad: ["Qalado jira", "Problems found"],
  admReadFail: ["Template-ka lama akhriyi karo.", "The template could not be read."],
  admAllDocs: ["Dhammaan dukumintiyada", "All documents"],
  admLoading: ["La dejiyayo…", "Loading…"],
  admNoDocs: [
    "Weli dukumenti ma jirto.",
    "No documents in the workspace yet.",
  ],
  admDraftRef: ["(draft)", "(draft)"],
  admGeneratedBadge: ["La soo saaray", "Generated"],
  admDraftBadge: ["Qab", "Draft"],
  admDeleteFail: ["Tirtiriddu way fashilantay.", "Delete failed."],
  admAllAppts: ["Dhammaan ballannada", "All appointments"],
  admNoAppts: [
    "Weli ballan ma lahayn.",
    "No appointments booked yet.",
  ],
  admModeration: ["Ilalinka guddiga", "Board moderation"],
  admNoPosts: [
    "Weli qoraal ma jiro.",
    "No posts to moderate.",
  ],
  admCommentsNote: [
    "* Faallooyinka waxaa maareeya bogga dukumintiga oo la horay.",
    "* Comments are moderated from each document's detail page.",
  ],

  // Document detail page
  ddTitle: ["Dukumenti", "Document"],
  ddNotFound: [
    "Dukumeentigan lama helin. Wuxuu noqon karaa in la tirtiray, ama in kale ayaa lagu qaldamay.",
    "That document isn't here. It may have been deleted, or the address doesn't match.",
  ],
  ddNoId: ["Dukumintigu lama helin bogga.", "No document id in the address."],
  ddCreatedShort: ["La abuuray", "Created"],
  ddUpdatedShort: ["Wax la beddelay", "Updated"],
  ddCompleted: ["Waa la dhammaystiray", "Completed"],
  ddExported: ["Waa la soo saaray", "Exported"],
  ddTemplate: ["Template:", "Template:"],
  ddResume: ["Dib u bilow", "Resume interview"],
  ddRegenerate: ["Nuqul cusub oo draft ah", "Regenerate as draft"],
  ddRegenerateOk: [
    "Waa la nuquliyay — version cusub oo draft ah ayaa diyaar.",
    "Copied — a new draft is ready.",
  ],
  ddRegenerateFail: ["Nuqulidda waa fashilantay.", "Copy failed."],
  ddArchiveBtn: ["Kaydi kaydka", "Save to archive"],
  ddArchiveOk: ["Dukumeentiga waa la kaydiyay kaydka.", "Saved to the archive."],
  ddArchiveFail: ["Kaydinta waa fashilantay.", "Save failed."],
  ddFileMissingA: ["Faylka", "The"],
  ddFileMissingB: [
    " ma jiro halkan. Soo saar document-ga mar kale oo halkan ayuu ku soo qaadan doonaa.",
    " file isn't here. Generate the document again to put it here.",
  ],
  ddParties: ["Xafladaha", "Parties"],
  ddPartiesEmpty: ["Weli lama diiwaangelin.", "Not recorded yet."],
  ddSellers: ["Iibiyayaasha", "Sellers"],
  ddBuyers: ["Iibsadayaasha", "Buyers"],
  ddStoredAnswers: ["Jawaabaha la kaydiyay", "Stored answers"],
  ddLocalFiles: ["Faylaha maxalliga ah", "Local files"],
  ddLocalFilesHint: [
    "Dukumeentiga, drafts-ka iyo faylaha la soo saaray waxay ku jiraan computer-gaan oo keliya — internet la'aan. Soo saar nuqul ",
    "The document, drafts and generated files live on this computer only — no internet. Create a ",
  ],
  ddLocalFilesHintB: [
    " oo Settings-ka, si xogtu had iyo jeer ugu jirato.",
    " backup in Settings so the data is always safe.",
  ],
  ddBackArchive: ["Ku noqo kaydka", "Back to archive"],

  // Landing page
  ldOpenWorkspace: ["Fur xafiiska", "Open workspace"],
  ldLogin: ["Gala", "Log in"],
  ldGetStarted: ["Bilow", "Get started"],
  ldBuiltFor: ["waa loo sameeyay kooxda xafiiska", "built for our office team"],
  ldHeroA: ["Heshiisyada kiro, ", "Rental contracts, "],
  ldHeroHighlight: ["la isku dhisay", "assembled"],
  ldHeroB: [" — lama qorin mar.", " — not retyped."],
  ldHeroParagraph: [
    "Notary Doc Builder heshiiska kiro ee xafiiska wuxuu ka dhigay su'aallo la tartiibay. Su'aalaha hal jeer ka jawaab, dukumi la dhammaystiray ayaa template-kaaga Word ka soo baxa — la kaydiyay, oo kooxdu raadinta ku fureyso.",
    "Notary Doc Builder turns the office's rental contract into a guided interview. Answer the questions once and a finished DOCX comes out of your own Word template, archived and searchable for the whole team.",
  ],
  ldHeroCta: ["Fur xafiiska", "Open the workspace"],
  ldHeroCtaLogin: ["Gala diiwaankaaga", "Log in to your account"],
  ldInternalNote: [
    "* Qalab shaqada gudaha — akoonadu waxay gaar u yihiin shaqaalaha xafiiska.",
    "* Internal tool — accounts are for office staff only.",
  ],
  ldStepLabel: ["Heshiis Kiro — tallaabada 2 ee 10", "Heshiis Kiro — step 2 of 10"],
  ldMockLessor: ["Kireeyaha", "Kireeyaha (the lessor)"],
  ldMockFullname: ["Magaca buuxa", "Full name"],
  ldMockPhone: ["Telefoon", "Phone"],
  ldMockId: ["Nambarka aqonsi", "ID number"],
  ldMockBack: ["← Gadaal", "← Back"],
  ldMockNext: ["Xigay →", "Next →"],
  ldMockAdd: [
    "+ Kireeye kale ku dar · + marag ku dar",
    "+ Add another lessor · + Add a witness",
  ],
  ldMockFilled: ["placeholder kastaa waa la buuxiyay ✓", "every placeholder filled ✓"],
  ldStepChoose: ["Dooro", "Choose"],
  ldStepChooseNote: [
    "Heshiis Kiro → Guri Xaas, Qol Meherad, ama Jiingad",
    "Heshiis Kiro → Guri Xaas, Qol Meherad, or Jiingad",
  ],
  ldStepFill: ["Buuxi", "Fill"],
  ldStepFillNote: [
    "Su'aallo la tartiibay — 10 tallaabo; xafladuna beddelmayaan",
    "A guided 10-step interview with dynamic parties",
  ],
  ldStepVerify: ["Hubi", "Verify"],
  ldStepVerifyNote: [
    "Bogga la fiirinayo — hubinta ku qoran",
    "Review page with validation in Somali",
  ],
  ldStepBuild: ["Dhis", "Build"],
  ldStepBuildNote: [
    "DOCX la ka dhisay template-kaaga Word",
    "DOCX assembled from your own Word template",
  ],
  ldFeaturesTitleA: ["Wax kasta oo xafiisku u baahan yahay, ", "Everything the office needs, "],
  ldFeaturesTitleB: ["buug wargeys hal ah", "in one notebook"],
  ldFeaturesSub: [
    "Heshiisyada, ballannada, kaydka iyo ogeysiisyada kooxdu waxay ku dhex jiraan hal meel. Mashiinka ku shaqaynaya qab-koodada — noocyada heshiisyada lamadaha hore ku bilaabmay.",
    "Contracts, scheduling, the archive, and the team's notices live in one place. The engine behind it is configuration-driven, so new contract types slot in without rewriting the app.",
  ],
  ldF1Title: ["Su'aallo la tartiibay", "Guided interviews"],
  ldF1Text: [
    "Toban qayb oo la tartiibay — horay/gadaal loo socday, bar la muuqda iyo su'aalaha markay muhiim yihiin uun muuqda.",
    "Ten ordered sections, Next/Back navigation, a live progress bar, and conditional questions that only appear when they matter.",
  ],
  ldF2Title: ["Xafladaha ku dhexsoo-biiri", "Dynamic parties"],
  ldF2Text: [
    "Kireeyayaal, kiraystayaal iyo maragyo sida heshiisku u baahan yahay ku dar oo ka jar — waxba lama qorrin.",
    "Add as many lessors, lessees, and witnesses as the contract needs — nothing is hard-coded, add or remove rows freely.",
  ],
  ldF3Title: ["Template-kaaga Word", "Your Word template"],
  ldF3Text: [
    "Wuxuu kaliya buuxiyaa placeholder-yada template-ka xafiiska — naqshadda dukumintigu waa sida aad sameysay.",
    "The builder only fills the placeholders in your office's template. The document design stays exactly as you made it.",
  ],
  ldF4Title: ["Kaydka iyo raadinka", "Archive and search"],
  ldF4Text: [
    "Heshiiskasta la abuuray la kaydiyay; xafladiisa iyo tixraaciisa la yaqaan — diyaar in la furayo, faallo lagu dhabo, ama la dib soo geliyo.",
    "Every generated contract is stored with its parties and reference number, ready to open, comment on, or download again.",
  ],
  ldF5Title: ["Ballanta saxiixka", "Signing schedule"],
  ldF5Text: [
    "Ku dar ballanqaad saxiixka ku dhax dukumintiga — si kooxdu ogaato goorta iyo meesha saxiixu dhacayo.",
    "Book signing appointments against a document so the whole team knows when and where each contract gets signed.",
  ],
  ldF6Title: ["Guddiga kooxda iyo faallooyinka", "Team board and comments"],
  ldF6Text: [
    "Ogeysiisyada xafiiska ku qor bogga laga wada wardo; faallooyinkuna heshiiska kasta ku hoos jiraan.",
    "Post office notices on the shared board and keep the discussion on each contract in its own comment thread.",
  ],
  ldCtaTitle: [
    "U diyaar ma tahay inaad dhisato heshiiskaaga koowaad?",
    "Ready to build your first contract?",
  ],
  ldCtaSub: [
    "Gala, xulo Heshiis Kiro, su'aalaha ku dhammaystir — dukumintii dhammaystiran ayaa daqiiqado dhow la soo dejiyaa oo la kaydiyaa.",
    "Log in, pick Heshiis Kiro, work through the interview, and the finished DOCX is ready to download and archive in minutes.",
  ],
  ldFooter: [
    "Notary Doc Builder · heshiisyada laga dhisayo — aalad gudaha xafiiska",
    "Notary Doc Builder · internal contract assembly for the notary office",
  ],

  // Auth page
  auTitle: ["Gala Notary Doc Builder", "Sign in to Notary Doc Builder"],
  auDesc: [
    "Shaqaystayaasha xfiiska waxay galaan iimaylka shaqada — koodh hal-jeer ah ayaa la dirinaya.",
    "Office staff sign in with their work email — we'll send a one-time code.",
  ],
  auOr: ["Ama", "Or"],
  auGuest: ["Ku gal sidii dacaw", "Continue as guest"],
  auCodeSendFail: [
    "Koodhka lama dirin — mar kale isku day.",
    "Failed to send verification code. Please try again.",
  ],
  auCodeInvalid: [
    "Koodhka aad gelisay ma saxna.",
    "The verification code you entered is incorrect.",
  ],
  auGuestFailA: [
    "Galitaanka dacawka fashilmay: ",
    "Failed to sign in as guest: ",
  ],
  auGuestFailB: ["qalad aan la aqoon", "Unknown error"],
  auCheckTitle: ["Eeg iimaylka", "Check your email"],
  auCheckDescA: [
    "Koodh ayaan ku diray ",
    "We've sent a code to ",
  ],
  auTryAgainQ: ["Koodh kuma aragn? ", "Didn't receive a code? "],
  auTryAgain: ["Mar kale iskuday", "Try again"],
  auVerifying: ["Hubinayo…", "Verifying..."],
  auVerifyCode: ["Xaqiiji koodhka", "Verify code"],
  auUseDifferent: ["Iimayl kale isticmaal", "Use different email"],
  auSecuredBy: ["Ka amaan", "Secured by "],

  // 404 page
  nfTitle: ["404", "404"],
  nfBody: ["Bogga lama helin.", "Page Not Found"],

  // New Document picker (NewDocument.tsx)
  ndTitle: ["Dukumenti Cusub", "New Document"],
  ndSub: [
    "Dooro nooca heshiiska, kadibna nooca hoose — su'aalaha waxay la socdaan doorashadaada.",
    "Pick the contract type, then the sub-type — the questions follow your choice.",
  ],
  ndStep1: ["1 · Nooca Heshiiska", "1 · Contract type"],
  ndReady: ["Diyaar", "Ready"],
  ndStartNow: ["Bilow Hadda", "Start now"],
  ndPlanned: ["La qorsheeyay", "Planned"],
  ndPlannedNote: [
    "Weli lama dhisin — eeg catalog-ka si aad u aragto waxa imanaya.",
    "Not built yet — see the catalog for what is coming.",
  ],
  ndStep2Rental: ["2 · Nooca Kirada", "2 · Rental type"],
  ndStep2Property: ["2 · Nooca Hantida", "2 · Property type"],
  ndInterviewHint: [
    "Markaad bilowdo waxaa lagu hagayaa tallaabada kasta — tirada xubnaha, xogta, joogitaanka iyo wakiillada.",
    "You are walked through every step — the parties, details, attendance and representatives.",
  ],
  ndPreparing: ["Diyaarinaya…", "Preparing…"],
  ndStartInterview: ["Bilow Su'aalaha", "Start the interview"],
  ndCreateFail: [
    "Lama abuuri karin draft — fadlan isku day mar kale.",
    "Could not create a draft — please try again.",
  ],

  // Catalog page
  caTitle: ["Catalog Dukumintiyada", "Document Catalog"],
  caSub: [
    "Nooc kasta oo heshiis ah oo xafiisku taageero — kuwa diyaarsan hore, kuwa qorsheysan hoose.",
    "Every contract type the office supports — ready types first, planned ones below.",
  ],
  caSearchPlaceholder: ["Raadi catalog-ka…", "Search the catalog…"],
  caReady: ["Diyaar u isticmaal", "Ready to use"],
  caNoReady: [
    "Raadinku waxba ma helin kuwa diyaarsan.",
    "No ready types match your search.",
  ],
  caComingSoon: ["Waa imanaya", "Coming soon"],
  caNoPlanned: [
    "Raadinku waxba ma helin kuwa qorsheysan.",
    "No planned types match your search.",
  ],
  caEngineNote: [
    "* Mashiinku waa qaab-dhismeed: furitaanka nooc qorsheysan waa beddel xog, ma aha beddel kood — sidaas ayaa catalog-ku amaan ugu koro.",
    "* The engine is configuration-driven: enabling a planned type is a data change, not a code change — which is why the catalog can grow safely.",
  ],

  // Schedule page (Ballannada)
  scTitle: ["Ballannada", "Schedule"],
  scSub: [
    "Ballan saxiix ku samee dukumintiyadaada — ama kulambda kale oo xafiiska.",
    "Book signing appointments for your documents — or any other office meeting.",
  ],
  scYourAppts: ["Ballantaada", "Your appointments"],
  scLoading: ["La dejiyayo…", "Loading…"],
  scEmpty: [
    "Weli ballan ma jiro. Ballanta saxiixka ugu horreynta dhinaca midig ku qor.",
    "No appointments yet. Book your first signing on the right.",
  ],
  scDone: ["Dhamaystiran", "Done"],
  scCancel: ["Jooji", "Cancel"],
  scScheduled: ["La ballanqaaday", "Scheduled"],
  scCancelled: ["La joojiyay", "Cancelled"],
  scBook: ["Ballan samee", "Book an appointment"],
  scFieldTitle: ["Cinwaan *", "Title *"],
  scFieldDate: ["Taariikh *", "Date *"],
  scFieldTime: ["Waqtiga *", "Time *"],
  scFieldLocation: ["Goobta", "Location"],
  scFieldDocument: ["Dukumi la xidhay", "Linked document"],
  scNoDoc: ["— Waxba —", "— None —"],
  scDraftOption: ["Draft", "Draft"],
  scFieldNotes: ["Faalooyin", "Notes"],
  scTitlePlaceholder: ["Saxiix — Heshiis Kiro DPN-K-004", "Signing — Heshiis Kiro DPN-K-004"],
  scLocationPlaceholder: ["Xafiiska, laanta Hodan…", "Office, Hodan branch…"],
  scNotesPlaceholder: ["Kuma yimid, maxay la soo qaadan…", "Who attends, what to bring…"],
  scBooking: ["La ballanqaadayaa…", "Booking…"],
  scBookBtn: ["Ballan ku qor", "Book appointment"],
  scMissing: [
    "Fadlan buuxi cinwaanka, taariikhda, iyo waqtiga.",
    "Please fill the title, the date, and the time.",
  ],
  scToastOk: ["Ballanta waa la horgejiyay!", "The appointment is booked!"],
  scToastFail: [
    "Ballanta lama abuurin — fadlan isku day mar kale.",
    "The appointment was not created — please try again.",
  ],

  // Team Board page (Guddiga Kooxda)
  tbTitle: ["Guddiga Kooxda", "Team Board"],
  tbSub: [
    "Ogeysiisyo iyo warar gaaban oo xafiiska oo dhan — xiran sida qoraallo dhagxaanta ah.",
    "Notices and short updates for the whole office — pinned like notes on the corkboard.",
  ],
  tbLoading: ["La dejiyayo…", "Loading…"],
  tbEmpty: ["Weli qoraal ma jiro.", "No posts yet"],
  tbEmptyHint: [
    "Iska qor qoraalka ugu horreynta ee guddiga.",
    "Be the first to pin a note to the board.",
  ],
  tbPin: ["Qoraal cusub dheji", "Pin a new note"],
  tbFieldTitle: ["Cinwaan *", "Title *"],
  tbFieldMessage: ["Fariin *", "Message *"],
  tbTitlePlaceholder: ["Template cusub, macmiil imanaya…", "Template updated, client visiting…"],
  tbMessagePlaceholder: ["Qor ogeysiiska kooxda…", "Write the notice for the team…"],
  tbPosting: ["La daabacayaa…", "Posting…"],
  tbPost: ["Guddiga ku qor", "Post to board"],
  tbMissing: [
    "Fadlan buuxi cinwaanka iyo fariinta.",
    "Please fill the title and the message.",
  ],
  tbToastOk: ["Post-ka waa la daabacay!", "The post is published!"],
  tbToastFail: [
    "Post-ka lama daabacin — fadlan isku day mar kale.",
    "The post was not published — please try again.",
  ],
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
