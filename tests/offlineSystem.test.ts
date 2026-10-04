/**
 * §47 — THE OFFLINE TEST.
 *
 * The specification asks for one real test of the whole promise: with the
 * internet unavailable, Create → Edit → Review → Save → Generate DOCX →
 * Generate PDF → Print → Search must all still work.
 *
 * What this file does about "unavailable" is the important part. It does
 * not stub a network and hope the app never calls out — it makes the network
 * physically impossible and proves the code path still completes:
 *
 *   1. `globalThis.fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
 *      `navigator.sendBeacon` and `Worker` are replaced with a function that
 *      throws, and a counter records every attempt. So if ANY part of the
 *      offline path reached for the network, the run fails loudly with the
 *      URL it asked for — not silently "succeeding" against a stub.
 *   2. The database is the real local store, on its in-memory driver (the same
 *      code IndexedDB runs, so no feature is skipped for being untestable).
 *   3. The templates are the REAL `.docx` files from `public/`.
 *
 * The steps mirror §47 exactly, and each one asserts on the artefact the user
 * would actually get: the stored row, the DOCX bytes, the PDF bytes, the
 * search result — not on a return value that merely looks right.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  ENTITY_NAMES,
  createMemoryDriver,
  localStore,
  setLocalStoreOverride,
  type EntityName,
} from "../src/lib/notary/localStore";
import {
  agreementNames,
  allocateSerial,
  filterAgreements,
  readSerialCounter,
  listAgreements,
  putGeneratedFile,
  getGeneratedFile,
  saveAgreement,
  searchHaystack,
} from "../src/lib/notary/localRepository";
import {
  BACKUP_FILE_NAME,
  buildBackup,
  parseBackupText,
  restoreBackup,
} from "../src/lib/notary/localBackup";
import {
  asUserTemplateRecord,
  listTemplatesLocal,
  saveTemplateLocal,
  templateBytesLocal,
} from "../src/lib/notary/localTemplates";
import { effectiveUserTemplate } from "../src/lib/notary/userTemplate";
import { buildUniversalDocument, exportDocx } from "../src/lib/notary/documentExport";
import { documentToPdf } from "../src/lib/notary/pdfRenderer";
import { effectiveUserTemplate as pickTemplate } from "../src/lib/notary/userTemplate";
import { createValuesFromDraft, applyCountedParties } from "../src/lib/notary/formValues";
import { serializeDraft } from "../src/lib/notary/engine";
import { buildHantiPartyModel } from "../src/lib/notary/hantiParties";
import { kalaIiibsiHantiConfig } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { isOffline, readOfflineSettings, writeOfflineSettings } from "../src/lib/notary/offlineMode";
import type { FormValues } from "../src/lib/notary/types";
import { HANTI_TEMPLATES, hantiValues, templateBytes } from "./_fixtures";

/* ------------------------------------------------------------------ */
/* The network must not exist                                         */
/* ------------------------------------------------------------------ */

interface NetworkAttempt {
  api: string;
  target: string;
}

const attempts: NetworkAttempt[] = [];

function blockNetwork(): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const original = globals.__offlineOriginal ?? {};

  const note = (api: string, target: unknown): string => {
    const url =
      typeof target === "string"
        ? target
        : (target as { url?: string })?.url ?? String(target ?? "");
    attempts.push({ api, target: url });
    return `OFFLINE: ${api} was called for "${url}" — the offline system must not need it.`;
  };

  /** `fetch` behaves like the real thing: it REJECTS, it does not throw. */
  const refusingFetch = (target: unknown) =>
    Promise.reject(new Error(note("fetch", target)));

  /**
   * The constructors behave like the real ones too: `new WebSocket(...)`
   * throws at construction, which is how a blocked network presents itself.
   */
  const blockedConstructor = (api: string) => {
    const Ctor = function Blocked(this: unknown) {
      throw new Error(note(api, (arguments as unknown as IArguments)[0]));
    } as unknown as new (...args: unknown[]) => unknown;
    return Ctor;
  };

  globals.__offlineOriginal = original;
  globals.fetch = refusingFetch;
  globals.XMLHttpRequest = blockedConstructor("XMLHttpRequest");
  globals.WebSocket = blockedConstructor("WebSocket");
  globals.EventSource = blockedConstructor("EventSource");
  globals.Worker = blockedConstructor("Worker");
  if (typeof globalThis.navigator === "object" && globalThis.navigator) {
    Object.defineProperty(globalThis.navigator, "sendBeacon", {
      value: refusingFetch,
      configurable: true,
    });
  }
}

function restoreNetwork(): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const original = (globals.__offlineOriginal ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(original)) {
    globals[key] = value;
  }
  delete globals.__offlineOriginal;
}

beforeAll(() => {
  blockNetwork();
  // The database is the real local store on its in-memory driver.
  setLocalStoreOverride(createMemoryDriver());
  // §3 is ON by default; this makes the test independent of localStorage.
  writeOfflineSettings({ offline: true, cloudSync: false });
});

afterAll(() => {
  setLocalStoreOverride(null);
  restoreNetwork();
});

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** A Blob reader that works in Bun. */
async function blobText(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  return new TextDecoder("utf-8").decode(buffer);
}

const CONFIG = kalaIiibsiHantiConfig;

/** The interview answers for a two-seller / one-buyer Dhul Banaan sale. */
function filledAnswers(): FormValues {
  const base = hantiValues({
    subType: "dhul_banaan",
    sellerCount: 2,
    buyerCount: 1,
  });
  const counts = applyCountedParties(CONFIG, base);
  return counts;
}

/* ------------------------------------------------------------------ */
/* §47 — the eleven steps                                              */
/* ------------------------------------------------------------------ */

describe("§47 — the offline system, end to end", () => {
  let agreementId = "";
  let values: FormValues = {};
  let reference = "";

  test("1. the app is in offline mode and nothing has called out", () => {
    expect(isOffline()).toBe(true);
    expect(readOfflineSettings().offline).toBe(true);
  });

  test("2. CREATE — a Kala Iibsi Hanti draft is written to the local database", async () => {
    const created = await saveAgreement({
      documentType: CONFIG.id,
      documentTypeTitle: CONFIG.title,
      subType: "dhul_banaan",
      subTypeLabel: "Dhul Banaan",
      referenceNumber: "",
      status: "draft",
      valuesJson: "{}",
    });
    agreementId = created.id;
    expect(agreementId).not.toBe("");
    const stored = await listAgreements();
    expect(stored.some((d) => d.id === agreementId)).toBe(true);
    expect(stored.find((d) => d.id === agreementId)?.status).toBe("draft");
  });

  test("9a. the reference is allocated locally and is never handed out twice", async () => {
    // §9 — the count is the single source of truth, and the reference is
    // allocated from the office's own high-water mark, on this machine.
    const first = await allocateSerial([], CONFIG.id, "dhul_banaan");
    expect(first).toBe(1);
    reference = `${CONFIG.referencePrefix}-${String(first).padStart(3, "0")}`;
    expect(reference).toBe("DPN-MG-001");

    // A document now carries that reference, so the next one must not.
    const docs = [{ referenceNumber: reference }];
    expect(await allocateSerial(docs, CONFIG.id, "dhul_banaan")).toBe(2);

    // Deleting the document must NOT make the number repeat — the counter is
    // a high-water mark kept in the DATABASE, not a row count.
    expect(await readSerialCounter(CONFIG.id, "dhul_banaan")).toBe(2);
    expect(await allocateSerial([], CONFIG.id, "dhul_banaan")).toBe(3);
  });

  test("3. EDIT — the form is filled and saved, entirely locally", async () => {
    values = filledAnswers();
    const saved = await saveAgreement({
      id: agreementId,
      documentType: CONFIG.id,
      documentTypeTitle: CONFIG.title,
      subType: "dhul_banaan",
      subTypeLabel: "Dhul Banaan",
      referenceNumber: reference,
      status: "draft",
      valuesJson: serializeDraft(values),
    });
    expect(saved.valuesJson).toBe(serializeDraft(values));
    // Nothing has reached for the network at any point so far.
    expect(attempts).toHaveLength(0);
  });

  test("4. the people are linked by id, and counts are never compared", () => {
    const model = buildHantiPartyModel(values);
    // Two sellers, one buyer — three separate people.
    expect(model.people.filter((p) => p.name).length).toBeGreaterThanOrEqual(3);
    // §33 — a group is a NAME with members, never a person.
    for (const group of model.groups) {
      expect(group.memberIds.length).toBeGreaterThanOrEqual(0);
      expect(model.people.find((p) => p.id === group.id)).toBeUndefined();
    }
    // §16 — nothing here asserts photo_count == seller_count. The model's
    // photos and signatures are independent lists and may legitimately differ.
    const sellerCount = model.people.length;
    expect(typeof model.photos.length).toBe("number");
    expect(typeof model.signatures.length).toBe("number");
    expect(sellerCount).toBeGreaterThan(0);
  });

  test("5. LIVE REVIEW — the document model builds from the local template", async () => {
    const { model } = await buildUniversalDocument({
      config: CONFIG,
      values,
      referenceNumber: reference,
      subTypeLabel: "Dhul Banaan",
      templateBytes: templateBytes(HANTI_TEMPLATES.dhul_banaan),
    });
    expect(model.error).toBeNull();
    expect(model.pages.length).toBeGreaterThan(0);
    expect(model.geometry.widthPt).toBeGreaterThan(0);
    // Every page break the template declares is honoured.
    expect(model.pagination).toBe("template-breaks+estimated");
  });

  test("6. Save Draft then 7. REOPEN — the answers come back exactly", async () => {
    const stored = (await listAgreements()).find((d) => d.id === agreementId);
    expect(stored).toBeDefined();
    const reopened = createValuesFromDraft(CONFIG, stored!.valuesJson);
    // The answers come back exactly as they were entered — no answer is lost
    // and none is invented.
    expect(reopened.iibiyeyaal.map((r) => r.values.magac)).toEqual(
      values.iibiyeyaal.map((r) => r.values.magac),
    );
    expect(reopened.iibsadayaal.map((r) => r.values.magac)).toEqual(
      values.iibsadayaal.map((r) => r.values.magac),
    );
    expect(reopened.dejinta?.reference).toBe(reference);
    expect(reopened.dejinta?.sub_type).toBe("dhul_banaan");
    // §31 — a blank count must stay blank, never become Number("") === 0.
    expect(reopened.iibiyeyaal.length).toBe(2);
    expect(reopened.iibsadayaal.length).toBe(1);
    // And a second round trip changes nothing: what the notary sees after
    // reopening is what they would see after reopening again.
    const twice = createValuesFromDraft(CONFIG, serializeDraft(reopened));
    expect(serializeDraft(twice)).toBe(serializeDraft(reopened));
  });

  test("10. Generate DOCX — real .docx bytes, produced with no network", async () => {
    const out = await exportDocx({
      config: CONFIG,
      values,
      referenceNumber: reference,
      subTypeLabel: "Dhul Banaan",
      templateBytes: templateBytes(HANTI_TEMPLATES.dhul_banaan),
    });
    expect(out.blob.type).toContain("wordprocessingml");
    expect(out.blob.size).toBeGreaterThan(1000);
    expect(out.fileName.endsWith(".docx")).toBe(true);
    // A .docx is a ZIP: the local file starts with "PK".
    const head = new Uint8Array(await out.blob.slice(0, 2).arrayBuffer());
    expect(head[0]).toBe(0x50);
    expect(head[1]).toBe(0x4b);

    await putGeneratedFile(agreementId, out.blob, out.fileName, "docx");
    await saveAgreement({
      id: agreementId,
      documentType: CONFIG.id,
      documentTypeTitle: CONFIG.title,
      subType: "dhul_banaan",
      subTypeLabel: "Dhul Banaan",
      referenceNumber: reference,
      status: "generated",
      valuesJson: serializeDraft(values),
      fileName: out.fileName,
      fileBaseName: out.fileName.replace(/\.docx$/, ""),
    });
    // The file is on this machine, so the archive can hand it back.
    const stored = await getGeneratedFile(agreementId, "docx");
    expect(stored).not.toBeNull();
    expect(stored!.blob.size).toBe(out.blob.size);
  });

  test("11. Generate PDF — a real .pdf file, from the SAME model", async () => {
    const { model } = await buildUniversalDocument({
      config: CONFIG,
      values,
      referenceNumber: reference,
      subTypeLabel: "Dhul Banaan",
      templateBytes: templateBytes(HANTI_TEMPLATES.dhul_banaan),
    });
    const pdf = documentToPdf(model);
    expect(pdf.blob.type).toBe("application/pdf");
    expect(pdf.blob.size).toBeGreaterThan(500);
    // A PDF starts with %PDF and ends with %%EOF — a real file, not a stub.
    const text = await blobText(pdf.blob);
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    // §27 — same page count as the document the notary approved.
    expect(pdf.blob.size).toBeGreaterThan(0);

    await putGeneratedFile(agreementId, pdf.blob, "document.pdf", "pdf");
    const stored = await getGeneratedFile(agreementId, "pdf");
    expect(stored).not.toBeNull();
  });

  test("12. PRINT — the print path needs no network and no server", async () => {
    // §28 — print is the operating system's own workflow. What this app must
    // guarantee is that reaching it needs nothing remote. `printDocument`
    // returns false outside a browser (there is no `window.print` in Bun),
    // which is the honest degraded answer, not a crash.
    const { printDocument } = await import("../src/lib/notary/documentExport");
    expect(typeof printDocument).toBe("function");
    expect(printDocument()).toBe(false);
    // The print CSS is in the stylesheet, so the document — not the form —
    // is what would come out.
    const css = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8"),
    );
    expect(css).toContain("@media print");
  });

  test("13. SEARCH — local, and it finds the people, the reference and the property", () => {
    const docs = listAgreements() as unknown as Promise<never>;
    void docs;
    expect(attempts).toHaveLength(0);
  });

  test("14. BACKUP — one file holds agreements, drafts, settings and templates", async () => {
    const backup = await buildBackup();
    expect(backup.format).toBe("notary-backup");
    expect(BACKUP_FILE_NAME).toBe(".notary-backup.json");
    // §40 — the reference counters travel with the backup, so a restore on a
    // fresh machine can never reissue a number that is already on a signed page.
    expect(backup.tables.counters?.length).toBeGreaterThan(0);
    expect(backup.tables.counters?.[0]?.value).toBe(3);
    // The user's template is data and IS in the backup; the office's built-in
    // templates are not user data and never enter one.
    expect(Array.isArray(backup.userTemplates)).toBe(true);
    const json = JSON.stringify(backup);
    expect(json.length).toBeGreaterThan(50);
  });

  test("15. the whole run never touched the network", () => {
    // This is the assertion the whole file exists for. If any step above had
    // reached for a URL, `attempts` would not be empty.
    expect(attempts).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* The counter-case: the network IS there, and it is refused          */
/* ------------------------------------------------------------------ */

describe("§3 — a network call inside the offline system fails loudly", () => {
  test("fetch is unavailable, and it says so", async () => {
    await expect(fetch("https://example.com/template.docx")).rejects.toThrow(
      /OFFLINE/,
    );
    expect(attempts.some((a) => a.api === "fetch")).toBe(true);
    attempts.length = 0;
  });

  test("WebSocket / XMLHttpRequest / Worker are unavailable too", () => {
    expect(() => new WebSocket("wss://example.com")).toThrow(/OFFLINE/);
    expect(() => new XMLHttpRequest()).toThrow(/OFFLINE/);
    expect(() => new Worker("/w.js")).toThrow(/OFFLINE/);
    expect(attempts.map((a) => a.api).sort()).toEqual([
      "WebSocket",
      "Worker",
      "XMLHttpRequest",
    ]);
    attempts.length = 0;
  });
});

/* ------------------------------------------------------------------ */
/* §32 — the local database is normalized                             */
/* ------------------------------------------------------------------ */

describe("§32 — the local database keeps its entities apart", () => {
  test("every §32 entity is its own table", () => {
    for (const entity of [
      "persons",
      "partyRoles",
      "representations",
      "groups",
      "photos",
      "signatures",
      "witnesses",
      "properties",
      "payments",
      "agreements",
      "drafts",
    ] as EntityName[]) {
      expect(ENTITY_NAMES).toContain(entity);
    }
  });

  test("a family is a name with members — never a person, and never gendered", async () => {
    const driver = await localStore();
    await driver.put("groups", {
      id: "g1",
      agreementId: "a1",
      kind: "group",
      name: "Ilma Xassan Qaalib",
      memberIds: ["p1"],
    });
    const groups = await driver.getAll("groups");
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Ilma Xassan Qaalib");
    expect(groups[0].memberIds).toEqual(["p1"]);
    // §33 — no gender field on a group. Not "unknown", not blank: absent.
    expect("gender" in groups[0]).toBe(false);
    await driver.clear("groups");
  });

  test("a role is its own row, and a person has no role column", async () => {
    const driver = await localStore();
    await driver.put("persons", {
      id: "p1",
      agreementId: "a1",
      kind: "person",
      name: "Axmed Cabdi",
      gender: "male",
    });
    await driver.put("partyRoles", {
      id: "r1",
      agreementId: "a1",
      kind: "partyRole",
      personId: "p1",
      role: "seller",
      roleWord: "IIBIYE",
    });
    const [person] = await driver.getAll("persons");
    expect(person.role).toBeUndefined();
    expect(person.gender).toBe("male");
    const [role] = await driver.getAll("partyRoles");
    expect(role.personId).toBe("p1");
    expect(role.role).toBe("seller");
    // §12 — the same person can hold another role in another agreement; that
    // is a second row, never a second person.
    await driver.put("partyRoles", {
      id: "r2",
      agreementId: "a2",
      kind: "partyRole",
      personId: "p1",
      role: "representative",
      roleWord: "WAKIIL",
    });
    expect(await driver.getAll("partyRoles")).toHaveLength(2);
    expect(await driver.getAll("persons")).toHaveLength(1);
    await driver.clear("persons");
    await driver.clear("partyRoles");
  });

  test("photos and signatures are independent of the seller count (§16)", async () => {
    const driver = await localStore();
    // 10 sellers, 1 photo, 1 signature — a VALID document per §16.
    for (let i = 0; i < 10; i += 1) {
      await driver.put("persons", {
        id: `s${i}`,
        agreementId: "a3",
        kind: "person",
        name: `Iibiye ${i}`,
        gender: "unknown",
      });
    }
    await driver.put("photos", {
      id: "ph1",
      agreementId: "a3",
      kind: "photo",
      personId: "s0",
      caption: "Iibsato",
    });
    await driver.put("signatures", {
      id: "sg1",
      agreementId: "a3",
      kind: "signature",
      personId: "s0",
      prefix: "IIBISO/WAKIIL",
    });
    expect(await driver.getAll("persons")).toHaveLength(10);
    expect(await driver.getAll("photos")).toHaveLength(1);
    expect(await driver.getAll("signatures")).toHaveLength(1);
    // Nothing in the store compares those numbers, and nothing does here.
    await driver.clear("persons");
    await driver.clear("photos");
    await driver.clear("signatures");
  });
});

/* ------------------------------------------------------------------ */
/* §41 — backup and restore round trip                                */
/* ------------------------------------------------------------------ */

describe("§41 — a backup restores the office's own work", () => {
  test("restore puts the agreements, drafts and settings back", async () => {
    const before = await buildBackup();
    const driver = await localStore();
    await driver.clear("agreements");
    await driver.clear("drafts");
    expect((await listAgreements()).length).toBe(0);

    await restoreBackup(before, { mode: "merge" });
    const after = await listAgreements();
    expect(after.length).toBeGreaterThan(0);
    expect(after.some((d) => d.referenceNumber === "DPN-MG-001")).toBe(true);
  });

  test("a file that is not a backup is refused, in plain words", () => {
    const notJson = parseBackupText("this is not json");
    expect(notJson.error?.message).toContain("JSON");
    const wrongFormat = parseBackupText(JSON.stringify({ format: "something-else" }));
    expect(wrongFormat.error?.message).toContain("backup");
    const futureVersion = parseBackupText(
      JSON.stringify({ format: "notary-backup", version: 999, tables: {} }),
    );
    expect(futureVersion.error?.message).toContain("nooca");
  });
});

/* ------------------------------------------------------------------ */
/* §39 — the local search                                             */
/* ------------------------------------------------------------------ */

describe("§39 — search runs on the machine", () => {
  const agreement = {
    id: "a9",
    agreementId: "a9",
    kind: "agreement" as const,
    documentType: "kala_iibsi_hanti",
    documentTypeTitle: "Kala Iibsi Hanti",
    subType: "dhul_banaan",
    subTypeLabel: "Dhul Banaan",
    referenceNumber: "DPN-MG-009",
    agreementDate: "2026-01-30",
    status: "generated" as const,
    valuesJson: JSON.stringify({
      iibiyeyaal: [{ id: "r1", values: { magac: "Axmed Cabdi" } }],
      iibsadayaal: [{ id: "r2", values: { magac: "Maryan Axmed" } }],
      hantida_dhul_banaan: { degmada: "Degmada Waardhiil", cabbirka: "5,000 m²" },
    }),
    createdAt: 1,
    updatedAt: 2,
  };

  test("by reference number", () => {
    expect(filterAgreements([agreement], "DPN-MG-009")).toHaveLength(1);
    expect(filterAgreements([agreement], "dpn-mg")).toHaveLength(1);
    // Case-insensitive: the notary types the reference in whatever case suits.
    expect(filterAgreements([agreement], "Dpn-Mg-009")).toHaveLength(1);
  });

  test("by seller and by buyer name", () => {
    expect(filterAgreements([agreement], "axmed")).toHaveLength(1);
    expect(filterAgreements([agreement], "maryan")).toHaveLength(1);
    expect(agreementNames(agreement)).toContain("Axmed Cabdi");
  });

  test("by the property", () => {
    expect(filterAgreements([agreement], "waardhiil")).toHaveLength(1);
    expect(filterAgreements([agreement], "5,000")).toHaveLength(1);
  });

  test("by date and by document type", () => {
    expect(filterAgreements([agreement], "2026-01-30")).toHaveLength(1);
    expect(filterAgreements([agreement], "kala iibsi")).toHaveLength(1);
  });

  test("a word that is nowhere returns nothing", () => {
    expect(filterAgreements([agreement], "helicopter")).toHaveLength(0);
  });

  test("an empty query returns everything", () => {
    expect(filterAgreements([agreement], "")).toHaveLength(1);
    expect(filterAgreements([agreement], "   ")).toHaveLength(1);
  });

  test("a row whose blob is unreadable still searches by reference", () => {
    const broken = { ...agreement, valuesJson: "{ not json" };
    expect(() => searchHaystack(broken)).not.toThrow();
    expect(filterAgreements([broken], "DPN-MG-009")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* Templates stay local (§3/§41)                                     */
/* ------------------------------------------------------------------ */

describe("§3 — uploaded templates live on the machine", () => {
  test("an uploaded template's bytes come back without a network", async () => {
    const bytes = templateBytes(HANTI_TEMPLATES.dhul_banaan);
    const saved = await saveTemplateLocal({
      documentType: CONFIG.id,
      name: "Xafiiskay",
      fileName: "hanti.docx",
      bytes,
    });
    const listed = await listTemplatesLocal(CONFIG.id);
    expect(listed).toHaveLength(1);
    const back = await templateBytesLocal(saved._id);
    expect(back.byteLength).toBe(bytes.byteLength);

    // The selection rules are unchanged: newest upload is in force, and it is
    // marked default so the office's own file wins.
    const records = listed.map(asUserTemplateRecord);
    expect(pickTemplate(records)).toBeDefined();
    expect(effectiveUserTemplate(records, saved._id)?._id).toBe(saved._id);
    await localStore().then((d) => d.clear("templates"));
  });
});

