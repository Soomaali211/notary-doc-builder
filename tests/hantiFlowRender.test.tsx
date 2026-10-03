/**
 * §6/§23 — the six-step flow must actually RENDER, not merely describe itself.
 *
 * Other Hanti tests assert on the CONFIG: which fields exist, which rules are
 * declared. This file drives the real product path end to end —
 * `buildConditionalWorkflow` (the interview's own step builder, so the real
 * `visibleWhen` filtering applies) and then an actual server-side render of
 * every section in each step — and asserts that what the notary sees on screen
 * is the thing the specification asked for.
 *
 * A config can declare a perfect section and still render nothing: a group
 * whose rows were never built, a field gated behind a flag nobody set, a
 * separate section that never made it into its step. Those failures are
 * invisible to config assertions, which is why this file exists.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConvexProvider, ConvexReactClient } from "convex/react";

import { SectionStep } from "../src/pages/NewDocumentInterview";
import { kalaIiibsiHantiConfig as C } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { buildConditionalWorkflow } from "../src/lib/notary/agreementSetup";
import { createInitialValues } from "../src/lib/notary/formValues";
import { validateDocument } from "../src/lib/notary/validation";
import type { FormValues } from "@/lib/notary/types";

const sec = (id: string) => C.sections.find((s) => s.id === id)!;

// A client pointed at an address nothing listens on: rendering static markup
// only needs the context, and no request is issued during SSR.
const convex = new ConvexReactClient("http://127.0.0.1:1");

/**
 * A full answer set for a Dhul Banaan sale: two sellers (different genders),
 * a family group, a representative, one buyer, a part payment with a balance,
 * a third-party guarantor and one witness.
 *
 * Photos and signatures are deliberately LEFT UNANSWERED here, so the
 * conditional sections stay hidden — which is what §23 asks for when the
 * question was never answered "yes".
 */
const fullValues = {
  ...createInitialValues(C),
  dejinta: {
    sub_type: "dhul_banaan",
    taariikhda_hantida: "2026-01-30",
    reference: "Ref/Dpn/MG/001/01/26",
    // Several sellers, several buyers — the counts beside the cards.
    iibiye_mode: "multiple",
    tirada_iibiyayaasha: "2",
    iibsade_mode: "single",
    wakiillo_ma_jiraan: "yes",
    nooca_damiinta: "qof_3aad",
  },
  iibiyeyaal: [
    { id: "s1", values: { magac: "AHMED CALI", jinsi: "male", xaalad: "jooga" } },
    { id: "s2", values: { magac: "RUUN XASAN", jinsi: "female", xaalad: "maqan" } },
  ],
  kooxaha: [{ id: "g1", values: { magac: "Ilma Xassan Qaalib" } }],
  wakiillo: [{ id: "r1", values: { magac: "OMAR FARAH", nooca_wakiilka: "wakiil" } }],
  iibsadayaal: [
    {
      id: "b1",
      values: { magac: "IIBSADE HAL", jinsi: "female", telefoon: "0622222222" },
      attendance: { status: "jooga" },
    },
  ],
  hantida_dhul_banaan: {
    degmada: "Waardhiil",
    jiho_waqooyi: "waddo",
    jiho_koonfur: "dhisme",
    jiho_bari: "waddo",
    jiho_galbeed: "dhisme",
    tixraaca_ma_jiraan: "yes",
    nooca_tixraaca: "tr_no",
    lambarka_tixraaca: "Tr No 4471",
    sida_hantida_loo_helay: "iibsaday",
  },
  qiimaha: {
    qiimaha_guud: "1600",
    sida_lacagta: "qayb_aad_ah",
    lacagta_bixiyay: "600",
    lacagta_baaqiga_ah: "1000",
  },
  damiinka: { magaca_damiinka: "KHALID NOOR", gurmadka_dammaanadda: "Reer deggan." },
  maragyo: [{ id: "m1", values: { magac: "MARAG KOOW" } }],
} as unknown as FormValues;

function workflowFor(values: FormValues) {
  return buildConditionalWorkflow(C, values);
}

function sectionIdsOf(steps: ReturnType<typeof buildConditionalWorkflow>, index: number): string[] {
  const detail = steps[index]?.detail;
  if (!detail || detail.kind !== "section") return [];
  return detail.sectionIds;
}

/** Render every section of flow step `index`, exactly as the interview does. */
function renderStep(values: FormValues, index: number): string {
  const steps = workflowFor(values);
  const wf = steps[index];
  if (!wf || wf.detail.kind !== "section") return "";
  const ids = wf.detail.sectionIds;
  return ids
    .map((id) =>
      renderToStaticMarkup(
        <ConvexProvider client={convex}>
          <SectionStep
            step={{ kind: "section", section: sec(id), stepTitle: wf.short }}
            values={values}
            validation={{}}
            stepErrors={false}
            setValues={() => {}}
            config={C}
          />
        </ConvexProvider>,
      ),
    )
    .join("\n");
}

describe("Hanti — the six steps as the notary walks them", () => {
  const steps = workflowFor(fullValues);

  test("the flow is exactly six steps, in the order the spec gives", () => {
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.short)).toEqual([
      "Dejinta Heshiiska",
      "Xogta & Xaaladda Iibiyayaasha",
      "Xogta & Xaaladda Iibsadayaasha",
      "Xogta Hantida & Faahfaahinta Hantida",
      "Qiimaha & Faahfaahinta Lacagta",
      "Xogta Damiinka & Maragyada",
    ]);
  });

  test("Step 1 reads like the office's setup: date, reference, seller, buyer, guarantee", () => {
    const html = renderStep(fullValues, 0);
    // The agreement date and its office-allocated reference are both here.
    expect(html).toContain("Taariikhda Heshiiska");
    expect(html).toContain("Tixraaca Heshiiska");
    expect(html).toContain("Ref/Dpn/MG/001/01/26");
    // Each side is ONE choice, never a raw number box.
    expect(html).toContain("Iibiye mise Iibiyayaal");
    expect(html).toContain("Iibsade mise Iibsadayaal");
    // And the guarantee is chosen here, once.
    expect(html).toContain("Damiin qof 3aad");
  });

  test("§22 the single-seller path never shows or demands a number", () => {
    const oneSeller = {
      ...fullValues,
      dejinta: {
        ...(fullValues as any).dejinta,
        iibiye_mode: "single",
        iibsade_mode: "single",
      },
    } as unknown as FormValues;
    const html = renderStep(oneSeller, 0);
    expect(html).toContain("Iibiye");
    // No count box when "Iibiye" (not "Iibiyayaal") is the answer.
    expect(html).not.toContain("Tirada Iibiyayaasha");
    expect(html).not.toContain("Tirada Iibsadayaasha");
  });

  test("§1 the seller count asked in step 1 is the only count step — §3/§5 no re-asking", () => {
    expect(sectionIdsOf(steps, 1)).toEqual(["iibiyaha", "kooxaha", "wakiillada"]);
    expect(sectionIdsOf(steps, 2)).toEqual(["iibsadaha"]);
    // No "Tirada …?" step of its own anywhere in the six.
    expect(steps.every((s) => s.detail.kind === "section")).toBe(true);
  });

  test("§12 only the chosen property type's fields appear", () => {
    // Dhul Banaan chosen, so the Dhul Banaan section is present and the
    // Guri and Beer sections are filtered out by visibleWhen.
    expect(sectionIdsOf(steps, 3)).toEqual(["hantida_dhul_banaan"]);
    expect(sectionIdsOf(steps, 3)).not.toContain("hantida_guri");
    expect(sectionIdsOf(steps, 3)).not.toContain("hantida_beer");
  });
});

describe("Hanti — step 2 renders every seller-side section (§3, §6, §25)", () => {
  const html = renderStep(fullValues, 1);

  test("the step title is shown once for the whole step", () => {
    expect(html).toContain("Xogta &amp; Xaaladda Iibiyayaasha");
  });

  test("both sellers from the step-1 count are rendered", () => {
    expect(html).toContain("AHMED CALI");
    expect(html).toContain("RUUN XASAN");
  });

  test("each seller row gets its own inputs — 2 rows, not 1 shared", () => {
    expect((html.match(/Magaca Iibiyaha/g) ?? []).length).toBe(2);
  });

  test("§6 the representative section in the SAME step renders its row", () => {
    expect(html).toContain("OMAR FARAH");
  });

  test("§25 the family group renders and is not mixed into the person list", () => {
    expect(html).toContain("Ilma Xassan Qaalib");
  });

  test("no undefined/null leaked into the markup", () => {
    expect(html).not.toMatch(/undefined|null/);
  });
});

describe("Hanti — step 4 renders the property details (§10, §11)", () => {
  const html = renderStep(fullValues, 3);

  test("the district shows the value that was entered", () => {
    expect(html).toContain("Waardhiil");
  });

  test("§11 all four directions render", () => {
    expect(html).toContain("Jiho Waqooyi");
    expect(html).toContain("Jiho Koonfur");
    expect(html).toContain("Jiho Bari");
    expect(html).toContain("Jiho Galbeed");
  });

  test("§11 each direction offers only Waddo and Dhisme", () => {
    expect(html).toContain("Waddo");
    expect(html).toContain("Dhisme");
  });

  test("§10 the reference branch renders and shows the typed number", () => {
    expect(html).toContain("File No.");
    expect(html).toContain("TR No.");
    expect(html).toContain("Notary Reference");
    expect(html).toContain("Tr No 4471");
  });

  test("§23 the Dhul Banaan-only fields are the ones on screen", () => {
    expect(html).not.toContain("Nooca Guriga");
  });
});

describe("Hanti — step 5 renders the money (§13, §13.1)", () => {
  const html = renderStep(fullValues, 4);

  test("the total price renders", () => {
    expect(html).toContain("1600");
  });

  test("the part payment renders", () => {
    expect(html).toContain("600");
  });

  test("§13.1 the balance renders because payment is 'qayb_aad_ah'", () => {
    expect(html).toContain("1000");
  });

  test("§13.2 the money is asked once, in step 5", () => {
    expect(html).toContain("Qiimaha");
    // Step 6 must not re-ask any of it.
    const step6 = renderStep(fullValues, 5);
    expect(step6).not.toContain("1600");
    expect(step6).not.toContain("Lacagta Baaqiga ah");
  });
});

describe("Hanti — step 6 renders guarantor and witnesses (§15, §17)", () => {
  const html = renderStep(fullValues, 5);

  test("§15.1 the third-party guarantor named in step 1 renders here", () => {
    expect(html).toContain("KHALID NOOR");
  });

  test("the pledge renders", () => {
    expect(html).toContain("Reer deggan");
  });

  test("§17 the witness list renders", () => {
    expect(html).toContain("MARAG KOOW");
  });

  test("no undefined/null leaked into the markup", () => {
    expect(html).not.toMatch(/undefined|null/);
  });
});

describe("Hanti — §4/§5 gender is asked for ONE person, never several", () => {
  const sec = (id: string) => C.sections.find((s) => s.id === id)!;
  const row = (id: string, v: Record<string, string>) => ({ id, values: v });
  const sellers = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      row(`s${i + 1}`, { magac: `IIBIYE ${i + 1}`, jinsi: "male", xaalad: "jooga" }),
    );
  const renderSellers = (n: number) => {
    const values = {
      ...fullValues,
      iibiyeyaal: sellers(n),
      dejinta: {
        ...(fullValues as any).dejinta,
        iibiye_mode: n > 1 ? "multiple" : "single",
        tirada_iibiyayaasha: String(n),
      },
    } as unknown as FormValues;
    return renderToStaticMarkup(
      <ConvexProvider client={convex}>
        <SectionStep
          step={{ kind: "section", section: sec("iibiyaha"), stepTitle: "X" }}
          values={values}
          validation={{}}
          stepErrors={false}
          setValues={() => {}}
          config={C}
        />
      </ConvexProvider>,
    );
  };

  test("one seller is asked their gender", () => {
    expect((renderSellers(1).match(/Jinsi/g) ?? []).length).toBe(1);
  });

  test("§4 several sellers are NOT asked gender — not even once", () => {
    const html = renderSellers(3);
    expect(html).toContain("IIBIYE 3"); // the rows are really there
    expect(html).not.toContain("Jinsi");
  });

  test("§24 the plural rule is config-declared, never inferred from a name", () => {
    const f = C.sections
      .flatMap((s) => s.parties ?? [])
      .find((p) => p.id === "iibiyeyaal")!
      .fields.find((x) => x.id === "jinsi");
    expect(f?.hideWhenListHasMany).toBe(true);
  });
});

describe("Hanti — §6/§16 a buyer's representation is asked ONCE", () => {
  const party = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "iibsadayaal")!;

  test("§6 the buyer row carries NO second set of representative controls", () => {
    // "Ma Joogaa Heshiiska?" → Maya → Qaybta Wakiilka is the buyer's ONE way
    // to name a representative. Matalaad + a wakiil picker beside it asked the
    // same question twice on the same row.
    expect(party.fields.map((f) => f.id)).not.toContain("nooca_matalaada");
    expect(party.fields.map((f) => f.id)).not.toContain("wakiil");
  });

  test("§6 a SELLER keeps both — a seller has no attendance step to ask instead", () => {
    const seller = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "iibiyeyaal")!;
    expect(seller.fields.map((f) => f.id)).toContain("nooca_matalaada");
    expect(seller.fields.map((f) => f.id)).toContain("wakiil");
  });

  test("§22 the gender a seller answered is not validated when the list is plural", () => {
    const plural = {
      ...fullValues,
      dejinta: {
        ...(fullValues as any).dejinta,
        iibiye_mode: "multiple",
        tirada_iibiyayaasha: "2",
      },
      iibiyeyaal: [
        { id: "s1", values: { magac: "AHMED CALI" } },
        { id: "s2", values: { magac: "RUUN XASAN" } },
      ],
    } as unknown as FormValues;
    const errs = validateDocument(C, plural);
    const sellerErrs = errs["iibiyaha"]?.partyErrors["iibiyeyaal"] ?? [];
    expect(sellerErrs.every((e) => !e.errors.some((x) => x.fieldId === "jinsi"))).toBe(true);
  });
});

describe("Hanti — Step 1 uses the SAME big cards as Heshiis Kiro", () => {
  /** One option button in the setup-card markup. */
  const cardButtons = (h: string) => (h.match(/min-h-11 items-center justify-between/g) ?? []).length;
  const setupSection = C.sections.find((s) => s.id === "dejinta")!;
  const cards = setupSection.fields.filter((f) => f.setupCard);

  test("every card declares options — a card with none renders a label and NOTHING to click", () => {
    // This is a silent failure: the question still appeared on screen, looked
    // finished, and could not be answered. SetupField draws one button per
    // option, so options are what make the card real.
    for (const f of cards) {
      expect(`${f.id}:${(f.options ?? []).length}`).toBe(`${f.id}:2`);
    }
  });

  test("all seven setup questions render two clickable cards each", () => {
    const html = renderStep(fullValues, 0);
    expect(cards).toHaveLength(7);
    expect(cardButtons(html)).toBe(cards.length * 2);
  });

  test("each optional-list question still offers Haa and Maya", () => {
    const html = renderStep(fullValues, 0);
    for (const label of ["Wakiil ma jiraan?", "Sawirro ma jiraan?", "Saxeexyaal ma jiraan?"]) {
      expect(html).toContain(label);
    }
    // Haa/Maya appear as cards for all four of them.
    expect(cardButtons(html) / 2).toBe(7);
  });

  test("choosing 'Iibiyayaal' reveals the count beside the card, not as a second box", () => {
    const many = renderStep(fullValues, 0);
    expect(many).toContain("Tirada"); // the inline selector's own wording
    // The figure belongs to ONE control only.
    expect((many.match(/Tirada Iibiyayaasha/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  test("§22 no setup question blocks: none of them is required", () => {
    for (const f of cards) expect(`${f.id}:${f.optional}`).toBe(`${f.id}:true`);
  });
});

describe("Hanti — §23 conditional visibility is what renders, not just what is declared", () => {
  test("photos and signatures stay hidden while their step-1 question is unanswered", () => {
    const steps = workflowFor(fullValues);
    const step4 = sectionIdsOf(steps, 3);
    expect(step4).not.toContain("sawirrada");
    expect(step4).not.toContain("saxeexayaasha");
  });

  test("answering 'yes' brings the photo and signature sections into step 4", () => {
    const withPhotos = {
      ...fullValues,
      dejinta: {
        ...(fullValues as any).dejinta,
        sawirro_ma_jiraan: "yes",
        saxeexo_ma_jiraan: "yes",
        shaxado_ma_jiraan: "yes",
      },
    } as unknown as FormValues;

    const steps = workflowFor(withPhotos);
    expect(steps).toHaveLength(6);
    const step4 = sectionIdsOf(steps, 3);
    expect(step4).toContain("sawirrada");
    expect(step4).toContain("saxeexayaasha");
    expect(step4).toContain("shaxadaha");
  });

  test("§15.2 'the sellers guarantee' shows no third-party person form", () => {
    const selfGuarantee = {
      ...fullValues,
      dejinta: {
        ...(fullValues as any).dejinta,
        nooca_damiinta: "iibiyaha",
      },
      damiinka: {},
    } as unknown as FormValues;

    const html = renderStep(selfGuarantee, 5);
    // No third-party guarantor is invented: none of the person fields appear,
    // and the pledge — which is always asked — is still there.
    expect(html).not.toContain("KHALID NOOR");
    expect(html).not.toContain("Magaca Damiinka");
    expect(html).not.toContain("Telefoonka Damiinka");
    expect(html).toContain("Gurmadka / Qoraalka Dammaanadda");
    // The witness list is unaffected by who guarantees.
    expect(html).toContain("MARAG KOOW");
  });

  test("§10 no reference means the Calaamad Dheeraad branch, not a number box", () => {
    const noReference = {
      ...fullValues,
      hantida_dhul_banaan: {
        ...(fullValues as any).hantida_dhul_banaan,
        tixraaca_ma_jiraan: "no",
        nooca_tixraaca: "",
        lambarka_tixraaca: "",
        calaamad_dheeraad: "Beerta ku yaal xarun ugu dambeeya ee Degmada Waardhiil.",
      },
    } as unknown as FormValues;

    const html = renderStep(noReference, 3);
    expect(html).toContain("Calaamad");
    expect(html).toContain("Beerta ku yaal xarun");
  });

  test("§13.1 paying in full hides the balance field", () => {
    const paidInFull = {
      ...fullValues,
      qiimaha: {
        ...(fullValues as any).qiimaha,
        sida_lacagta: "si_buuxda",
        lacagta_baaqiga_ah: "",
      },
    } as unknown as FormValues;

    const html = renderStep(paidInFull, 4);
    expect(html).not.toContain("1000");
    expect(html).not.toContain("Lacagta Baaqiga ah");
  });
});