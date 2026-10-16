/**
 * WARBIXIN/MACAAMIISHA/LACAGAHA HELPERS — the three pure modules the
 * rebuilt pages read. Nothing here touches a store: every function takes
 * plain rows, so the tests pin exact math, exact labels-from-config and
 * the §33 rule that a group is never a person.
 */
import { describe, expect, test } from "bun:test";
import { getConfig } from "../src/lib/notary/documents";
import {
  clientsFromAgreements,
  groupCount,
  peopleCount,
} from "../src/lib/notary/clients";
import {
  agreementMoney,
  agreementsWithMoney,
} from "../src/lib/notary/financials";
import {
  byMonth,
  countsByType,
  documentCsvRows,
  toCsv,
} from "../src/lib/notary/reports";
import type { LocalAgreement } from "../src/lib/notary/localModel";

function agreement(overrides: Partial<LocalAgreement> & Pick<LocalAgreement, "valuesJson">): LocalAgreement {
  return {
    agreementId: "",
    kind: "agreement",
    id: overrides.id ?? "a1",
    documentType: "kala_iibsi_hanti",
    documentTypeTitle: "Kala Iibsi Hanti",
    subType: "guri",
    subTypeLabel: "Guri",
    referenceNumber: "DPN-MG-001",
    status: "generated",
    ...overrides,
  } as LocalAgreement;
}

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

describe("clientsFromAgreements", () => {
  const refSales = {
    iibiyeyaal: [
      { id: "s1", values: { magac: "Faarax Ali", telefoon: "+252 61 1110001" } },
    ],
    iibsadayaal: [
      { id: "b1", values: { magac: "Hoos Cabdi", telefoon: "" } },
    ],
  };

  test("one person in two agreements is ONE client with two appearances", () => {
    const same = agreement({ id: "a1", valuesJson: JSON.stringify(refSales) });
    const again = agreement({ id: "a2", valuesJson: JSON.stringify(refSales) });
    const entries = clientsFromAgreements([same, again]);
    const faarax = entries.find((e) => e.name === "Faarax Ali");
    expect(faarax).toBeDefined();
    expect(faarax!.appearances.map((a) => a.agreementId)).toEqual(["a1", "a2"]);
    expect(entries.filter((e) => e.name === "Faarax Ali")).toHaveLength(1);
  });

  test("the same name with a different phone stays TWO entries", () => {
    const other = {
      ...refSales,
      iibiyeyaal: [
        { id: "s1", values: { magac: "Faarax Ali", telefoon: "+252 63 9999999" } },
      ],
    };
    const entries = clientsFromAgreements([
      agreement({ id: "a1", valuesJson: JSON.stringify(refSales) }),
      agreement({ id: "a2", valuesJson: JSON.stringify(other) }),
    ]);
    expect(entries.filter((e) => e.name === "Faarax Ali")).toHaveLength(2);
  });

  test("§33 — a kooxaha row is a GROUP, never counted as a person", () => {
    const values = {
      ...refSales,
      kooxaha: [{ id: "k1", values: { magac: "Ilmo Xassan Qaalib" } }],
    };
    const entries = clientsFromAgreements([
      agreement({ valuesJson: JSON.stringify(values) }),
    ]);
    const group = entries.find((e) => e.name === "Ilmo Xassan Qaalib");
    expect(group).toBeDefined();
    expect(group!.isGroup).toBe(true);
    expect(groupCount(entries)).toBe(1);
    expect(peopleCount(entries)).toBe(2);
  });

  test("the role label comes from the document's own config", () => {
    const entries = clientsFromAgreements([
      agreement({ valuesJson: JSON.stringify(refSales) }),
    ]);
    const faarax = entries.find((e) => e.name === "Faarax Ali")!;
    const cfg = getConfig("kala_iibsi_hanti");
    const expected = cfg!.sections
      .flatMap((s) => s.parties ?? [])
      .find((p) => p.id === "iibiyeyaal")!.singular;
    expect(faarax.appearances[0].roleLabel).toBe(expected);
  });

  test("an unreadable draft is skipped without taking the list down", () => {
    const broken = agreement({ id: "bad", valuesJson: "{not json" });
    const good = agreement({ id: "a1", valuesJson: JSON.stringify(refSales) });
    const entries = clientsFromAgreements([broken, good]);
    expect(entries.find((e) => e.name === "Faarax Ali")).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* Financials                                                          */
/* ------------------------------------------------------------------ */

describe("agreementMoney", () => {
  test("money answers surface with the config's own labels, as stored", () => {
    const money = agreementMoney(
      agreement({
        valuesJson: JSON.stringify({
          qiimaha: {
            qiimaha_guud: "1600",
            lacagta_bixiyay: "600",
            sida_lacagta: "cash",
          },
        }),
      }),
    );
    const labels = Object.fromEntries(money.fields.map((f) => [f.fieldId, f.label]));
    expect(money.fields.map((f) => f.fieldId)).toEqual([
      "qiimaha_guud",
      "lacagta_bixiyay",
      "sida_lacagta",
    ]);
    expect(labels["qiimaha_guud"]).toContain("Qiimaha");
    expect(money.fields.find((f) => f.fieldId === "lacagta_bixiyay")!.value).toBe("600");
  });

  test("kirada is reported as the month rate it is — no total invented", () => {
    const money = agreementMoney(
      agreement({
        documentType: "heshiis_kiro",
        valuesJson: JSON.stringify({
          lacagta: { qiimaha_bil_ka: "350", habka_bixinta: "bank" },
        }),
      }),
    );
    const rate = money.fields.find((f) => f.fieldId === "qiimaha_bil_ka");
    expect(rate).toBeDefined();
    expect(rate!.value).toBe("350");
    expect(money.fields.map((f) => f.fieldId)).toContain("habka_bixinta");
  });

  test("an agreement with no money answers is not listed", () => {
    const empty = agreement({ id: "none", valuesJson: JSON.stringify({}) });
    expect(agreementMoney(empty).fields).toEqual([]);
    expect(agreementsWithMoney([empty])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

describe("reports", () => {
  const rows = [
    agreement({ id: "r1", documentType: "kala_iibsi_hanti", status: "generated", completedAt: Date.UTC(2026, 0, 15) }),
    agreement({ id: "r2", documentType: "kala_iibsi_hanti", status: "draft" }),
    agreement({ id: "r3", documentType: "heshiis_kiro", documentTypeTitle: "Heshiis Kiro", status: "archived", completedAt: Date.UTC(2026, 1, 3) }),
  ];

  test("countsByType aggregates and puts the biggest first", () => {
    const types = countsByType(rows);
    expect(types[0]).toMatchObject({ documentType: "kala_iibsi_hanti", count: 2 });
    expect(types[1]).toMatchObject({ documentType: "heshiis_kiro", count: 1 });
  });

  test("byMonth skips drafts, holds documents and income per month", () => {
    const payments = [
      { agreementId: "r1", amountPaid: "600", createdAt: Date.UTC(2026, 0, 15) },
      { agreementId: "r3", amountPaid: "350", createdAt: Date.UTC(2026, 1, 3) },
      { agreementId: "r3", amountPaid: "not a number", createdAt: Date.UTC(2026, 1, 4) },
    ] as never[];
    const months = byMonth(rows, payments as never);
    expect(months.map((m) => m.month)).toEqual(["2026-02", "2026-01"]);
    expect(months[1]).toMatchObject({ month: "2026-01", documents: 1, income: 600 });
    expect(months[0]).toMatchObject({ month: "2026-02", documents: 1, income: 350 });
  });

  test("documentCsvRows sums the ledger per agreement, once", () => {
    const payments = [
      { agreementId: "r1", amountPaid: "600", createdAt: 1 },
      { agreementId: "r1", amountPaid: "400", createdAt: 2 },
    ] as never[];
    const csvRows = documentCsvRows(rows, payments as never);
    expect(csvRows.find((r) => r.referenceNumber === "DPN-MG-001")!.recordedIncome).toBe("1000");
  });

  test("toCsv quotes and escapes the hard cases", () => {
    const csv = toCsv(
      [{ referenceNumber: 'DPN-"X"-1', documentTypeTitle: 'A, "B"' }],
      ["referenceNumber", "documentTypeTitle"],
    );
    expect(csv).toBe('"referenceNumber","documentTypeTitle"\r\n"DPN-""X""-1","A, ""B"""');
  });
});
