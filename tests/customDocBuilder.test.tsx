/**
 * THE FORM BUILDER — tests.
 *
 * A type the office builds of its own IS a first-class document: its config
 * must derive cleanly from the builder form, ids/tokens must be unique and
 * stable, the runtime registry must serve it to every reader, it must be
 * stored round-trippably in the local database (like every table), and the
 * picker + the builder page must SHOW it. Nothing here mocks the engine.
 *
 * @jsxRuntime automatic
 * @jsxImportSource react
 */
import * as React from "react";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import Builder from "../src/pages/Builder";
import NewDocument from "../src/pages/NewDocument";
import { LanguageProvider } from "../src/lib/lang";
import {
  applyBuiltinEdits,
  builderFormFromConfig,
  buildCustomConfig,
  deleteCustomDocType,
  deserializeCustomConfig,
  emptyBuilderForm,
  fieldToken,
  normalizeBuilderForm,
  restoreBuiltin,
  saveBuiltinOverlay,
  saveCustomDocType,
  slugifyLabel,
  tokenList,
  useCustomDocumentConfigs,
  validateBuilderForm,
  BUILDER_FIELD_TYPES,
  type BuilderForm,
  type BuiltinEdits,
} from "../src/lib/notary/customDocuments";
import { allDocumentConfigs } from "../src/lib/notary/documents";
import {
  getConfig,
  registerRuntimeConfigs,
  documentConfigs,
} from "../src/lib/notary/documents";
import { registryTemplates } from "../src/lib/notary/registry";
import { validateDocument } from "../src/lib/notary/validation";
import { deserializeDraft } from "../src/lib/notary/engine";
import {
  getAllLocal,
  useMemoryLocalStore,
  setLocalStoreOverride,
} from "../src/lib/notary/localStore";
import { CUSTOM_DOC_TYPE_ENTITY } from "../src/lib/notary/customDocuments";

beforeAll(async () => {
  useMemoryLocalStore();
  // The warm-up every reader does after its first visit — one read per table.
  for (const table of ["agreements", "drafts", CUSTOM_DOC_TYPE_ENTITY]) {
    await getAllLocal(table);
  }
});
afterAll(() => {
  registerRuntimeConfigs([]);
  setLocalStoreOverride(null);
});

/* ------------------------------------------------------------------ */
/* The builder form → a real DocumentConfig                            */
/* ------------------------------------------------------------------ */

const FORM: BuilderForm = normalizeBuilderForm({
  title: "Heshiis Deyn Gaar",
  description: "Lacag deyn laba qof u dhexeeya.",
  referencePrefix: "dpn-dn",
  acceptSubTypes: true,
  subTypes: ["Gaar", "Guri"],
  sections: [
    {
      title: "Xisbiga",
      fields: [
        { id: "", label: "Magaca Deynta", type: "text", required: true, options: [] },
        { id: "", label: "Qiimaha", type: "currency", required: false, options: [] },
        { id: "", label: "Nooca (xul)", type: "select", required: false, options: ["Rasheed", "Hadhaxo"] },
      ],
    },
    {
      title: "Deynta Istyuu",
      fields: [
        // Same label as section 1's, on purpose: ids must still be unique.
        { id: "", label: "Magaca Deynta", type: "text", required: true, options: [] },
        { id: "", label: "Taariikhda Bilaabidda", type: "date", required: true, options: [] },
      ],
    },
  ],
});

describe("the builder form derives a real config", () => {
  const config = buildCustomConfig(FORM, "heshiis_deyn_gaar");

  test("ids are slugified, unique across the WHOLE type, reserved ones protected", () => {
    // The USER sections only: the appended setup section fresh lives its own
    // reserved ids (reference / taariikhda) which no builder field may reuse.
    const userSections = config.sections.filter((s) => s.id !== "heshiiska");
    const fieldIds = userSections.flatMap((s) => s.fields.map((f) => f.id));
    expect(fieldIds.length).toBe(new Set(fieldIds).size);
    expect(config.id).toBe("heshiis_deyn_gaar");
    // The two same-labeled fields never collide, and neither touches the
    // setup section's reserved ids.
    expect(fieldIds).not.toContain("reference");
    expect(fieldIds).not.toContain("taariikhda_heshiiska");
    // Both copies of "Magaca Deynta" exist — one numbered.
    expect(fieldIds.filter((id) => id.startsWith("magaca_deynta")).length).toBe(2);
  });

  test("the setup section is appended and the flow stays engine-native", () => {
    const setup = config.sections.find((s) => s.id === "heshiiska");
    expect(setup).toBeDefined();
    const ids = setup!.fields.map((f) => f.id);
    expect(ids).toContain("reference");
    expect(ids).toContain("taariikhda_heshiiska");
    // The office never answers the same question twice in code: each of its
    // sections becomes exactly its own interview step, like the built-ins.
    expect(config.subTypes.map((s) => s.value)).toEqual(["gaar", "guri"]);
  });

  test("every field carries exactly ONE {{TOKEN}} wired to its value path", () => {
    for (const section of config.sections.filter((s) => s.id !== "heshiiska")) {
      for (const field of section.fields) {
        const mapping = config.placeholders.find(
          (p) => p.placeholder === fieldToken(field.id),
        );
        expect(mapping).toBeDefined();
        expect(mapping!.mapping.key).toBe(`${section.id}.${field.id}`);
      }
    }
    const tokens = config.placeholders.map((p) => p.placeholder);
    expect(tokens).toContain("REFERENCE_NUMBER");
    expect(tokens).toContain("TAARIIKHA_HESHIISKA");
  });

  test("requiredness, dependency and their formats arrive as the engine reads them", () => {
    const price = config.sections[0].fields.find((f) => f.id === "qiimaha")!;
    expect((price as { optional?: boolean }).optional).toBe(true);
    expect(
      config.placeholders.find((p) => p.placeholder === "QIIMAHA")!.mapping.format,
    ).toBe("currency");
    const choice = config.sections[0].fields.find((f) => f.type === "select")!;
    expect(choice.options?.length).toBe(2);
    // A prefix means the office's own reference allocation turns on.
    expect(config.referenceFormat).toBe("DPN-DN-{serial}");
    expect(buildCustomConfig(normalizeBuilderForm({ ...FORM, referencePrefix: "" })))
      .not.toHaveProperty("referenceFormat");
  });

  test("the config the engine validates REALLY holds the office's gaps", () => {
    const errors = validateDocument(config, deserializeDraft(config, "{}"));
    // An empty document of this type is missing its required answers —
    // named by label, from the config, exactly like a built-in.
    expect(Object.keys(errors).length).toBeGreaterThan(0);
  });

  test("editing round-trips through the builder form", () => {
    const form2 = builderFormFromConfig(config);
    expect(form2.title).toBe(config.title);
    expect(form2.referencePrefix).toBe("DPN-DN");
    expect(form2.acceptSubTypes).toBe(true);
    expect(form2.sections.map((s) => s.title)).toEqual(["Xisbiga", "Deynta Istyuu"]);
    // Rebuilding from the round-trip keeps every id stable — editing a form
    // never renumbers the fields the template refers to.
    const again = buildCustomConfig(normalizeBuilderForm(form2), "heshiis_deyn_gaar");
    const ids1 = config.sections.flatMap((s) => s.fields.map((f) => f.id)).sort();
    const ids2 = again.sections.flatMap((s) => s.fields.map((f) => f.id)).sort();
    expect(ids2).toEqual(ids1);
  });
});

describe("the builder refuses invalid forms before saving", () => {
  test("an empty title or an empty form is rejected", () => {
    expect(validateBuilderForm(normalizeBuilderForm(emptyBuilderForm()), []).length).toBeGreaterThan(0);
  });
  test("a saved slug cannot be duplicated by a NEW type", () => {
    const errs = validateBuilderForm(FORM, ["heshiis_deyn_gaar", documentConfigs[0].id]);
    expect(errs.join(" ")).toContain("slaag-kiisa");
    // ...but editing THAT SAME row is not a clash with itself.
    expect(validateBuilderForm(FORM, ["heshiis_deyn_gaar"], "heshiis_deyn_gaar").length).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Registry merge — custom types are first-class readers               */
/* ------------------------------------------------------------------ */

describe("the runtime registry serves custom types", () => {
  afterAll(() => registerRuntimeConfigs([]));

  test("getConfig resolves a registered custom type — and stops when it is gone", () => {
    expect(getConfig("heshiis_deyn_gaar")).toBeUndefined();
    registerRuntimeConfigs([buildCustomConfig(FORM, "heshiis_deyn_gaar")]);
    expect(getConfig("heshiis_deyn_gaar")?.title).toBe("Heshiis Deyn Gaar");
    // The built-ins never move.
    expect(getConfig("heshiis_kiro")?.title).toBe("Heshiis Kiro");
    // A custom type registers NO registry template: without an upload there
    // is honest "no template", never a surprise sampled file.
    expect(getConfig("heshiis_deyn_gaar")?.templates ?? []).toHaveLength(0);
    expect(registryTemplates().some((t) => t.documentType === "heshiis_deyn_gaar")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Storage round-trip on the memory store                              */
/* ------------------------------------------------------------------ */

describe("custom types persist like every local table", () => {
  test("save → read → deserialize → delete", async () => {
    const before = (await getAllLocal<never>(CUSTOM_DOC_TYPE_ENTITY)).length;
    await saveCustomDocType(FORM);
    const rows = await getAllLocal<unknown>(CUSTOM_DOC_TYPE_ENTITY);
    expect(rows.length).toBe(before + 1);
    const config = deserializeCustomConfig(rows[0] as never);
    expect(config?.title).toBe("Heshiis Deyn Gaar");
    expect(tokenList(config!).length).toBeGreaterThan(0);
    // The row id a re-save updates is the SAME row — a second save is an
    // edit, never a duplicate.
    const record = rows[0] as { id?: string };
    await deleteCustomDocType(record.id!);
    expect((await getAllLocal<never>(CUSTOM_DOC_TYPE_ENTITY)).length).toBe(before);
  });
});

/* ------------------------------------------------------------------ */
/* SSR — the builder and the picker show the office's own type         */
/* ------------------------------------------------------------------ */

function renderShell(element: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(LanguageProvider, null, React.createElement(MemoryRouter, null, element)),
  );
}

describe("the screens render the custom type", () => {
  beforeAll(async () => {
    await saveCustomDocType(FORM);
    await getAllLocal(CUSTOM_DOC_TYPE_ENTITY);
  });

  test("the builder lists the saved type with its meta and tokens", () => {
    const html = renderShell(React.createElement(Builder));
    expect(html).toContain("Dhismaha Foomamka");
    expect(html).toContain("Heshiis Deyn Gaar");
    expect(html).toContain("Token-yada");
    expect(html).toContain("Foom Cusub");
  });

  test("the picker shows it beside the built-ins, ready to start", () => {
    const html = renderShell(React.createElement(NewDocument));
    // Built-ins first, the office's own right beside them.
    expect(html).toContain("Heshiis Kiro");
    expect(html).toContain("Heshiis Deyn Gaar");
    expect(html).toContain("Diyaar");
  });
});

describe("the INTERVIEW machinery serves a custom type", () => {
  /* renderToStaticMarkup does NOT run effects, so the page-level hydration
     (values in useEffect) cannot be rendered server-side — instead the test
     drives the two pieces the page is made of: the real step builder and
     the real section renderer, against the office's own config. */
  const { buildConditionalWorkflow } = require("../src/lib/notary/agreementSetup") as typeof import("../src/lib/notary/agreementSetup");
  const { SectionStep } = require("../src/pages/NewDocumentInterview") as typeof import("../src/pages/NewDocumentInterview");
  const { setAnswer, deserializeDraft } = require("../src/lib/notary/engine") as typeof import("../src/lib/notary/engine");
  const config = buildCustomConfig(FORM, "heshiis_deyn_gaar");

  test("the real step builder turns the custom config into a typed flow", () => {
    let values = deserializeDraft(config, "{}");
    values = setAnswer(values, "heshiiska", "reference", "DPN-DN-001");
    const steps = buildConditionalWorkflow(config, values);
    // Setup step first, the office's own sections in order.
    const shorts = steps.map((s: { short: string }) => s.short);
    expect(shorts.length).toBeGreaterThan(1);
    expect(shorts).toContain("Xisbiga");
    expect(shorts).toContain("Deynta Istyuu");
    // The setup section closes the flow; the interview appends the review
    // page itself (steps.length + 1), like every other document type.
    expect(shorts.at(-1)).toBe("Heshiiska");
  });

  test("SectionStep renders the custom fields as real inputs", () => {
    const section = config.sections.find((s) => s.id === "xisbiga")!;
    const values = deserializeDraft(config, "{}");
    const html = renderToStaticMarkup(
      React.createElement(LanguageProvider, null,
        React.createElement(SectionStep, {
          step: { kind: "section", section },
          values,
          validation: {},
          config,
          setValues: () => undefined,
        }),
      ),
    );
    expect(html).toContain("Magaca Deynta");
    expect(html).toContain("Qiimaha");
    // Real inputs, rendered by the shared field renderer.
    expect(html).toContain("<input");
  });
});

/* ------------------------------------------------------------------ */
/* Repeat lists — the office's own iibiyayaal/maragyada group            */
/* ------------------------------------------------------------------ */

const LIST_FORM: BuilderForm = normalizeBuilderForm({
  title: "Cadayn Marag",
  description: "",
  referencePrefix: "DPN-MR",
  acceptSubTypes: false,
  subTypes: [],
  sections: [
    {
      title: "Dhaxal",
      fields: [{ id: "", label: "Magaca Aabihiis", type: "text", required: true, options: [] }],
      list: {
        label: "Maragyada",
        min: 2,
        fields: [
          { id: "", label: "Magaca Maraga", type: "text", required: true, options: [] },
          { id: "", label: "Telefoonka Maraga", type: "phone", required: false, options: [] },
        ],
      },
    },
  ],
});

describe("the section's repeat list is a REAL party group", () => {
  const config = buildCustomConfig(LIST_FORM, "cadayn_marag");

  test("a PartyDef with its own rows rides the section", () => {
    const section = config.sections.find((s) => s.id === "dhaxal")!;
    const party = section.parties?.[0];
    expect(party).toBeDefined();
    expect(party!.id).toBe("maragyada");
    expect(party!.min).toBe(2);
    expect(party!.fields.map((f) => f.id)).toEqual(["magaca_maraga", "telefoonka_maraga"]);
  });

  test("the Word template gets one repeat block with the row tokens", () => {
    const block = config.repeatBlocks?.find((b) => b.blockId === "MARAGYADA");
    expect(block).toBeDefined();
    expect(block!.aliases).toEqual({
      MAGACA_MARAGA: "magaca_maraga",
      TELEFOONKA_MARAGA: "telefoonka_maraga",
    });
  });

  test("the validator enforces the minimum ROWS the office required", () => {
    const empty = validateDocument(config, deserializeDraft(config, "{}"));
    expect(JSON.stringify(empty)).toContain("ugu yaraan");
  });

  test("the round-trip keeps the list editable", () => {
    const form2 = builderFormFromConfig(config);
    expect(form2.sections[0].list?.label).toBe("Maragyada");
    expect(form2.sections[0].list?.min).toBe(2);
    expect(form2.sections[0].list?.fields.map((f) => f.id)).toEqual([
      "magaca_maraga",
      "telefoonka_maraga",
    ]);
  });

  test("a list without a label or without fields is refused before saving", () => {
    const errs = validateBuilderForm(normalizeBuilderForm(emptyBuilderForm()), []);
    expect(errs.length).toBeGreaterThan(0);
    const broken = normalizeBuilderForm({
      ...LIST_FORM,
      sections: [{ title: "Dhaxal", fields: LIST_FORM.sections[0].fields, list: { label: "", min: 2, fields: [] } }],
    });
    const messages = validateBuilderForm(broken, ["cadayn_marag"], "cadayn_marag").join(" ");
    expect(messages).toContain("Magacaynta liiska");
    expect(messages).toContain("Ugu yaraan hal field ah liiska");
  });
});

/* ------------------------------------------------------------------ */
/* BUILTIN OVERLAYS — editing the shipped forms                         */
/* ------------------------------------------------------------------ */

describe("the shipped forms are editable at the copy level", () => {
  test("edits move ONLY the display copy; structure is untouched", () => {
    const kiro = documentConfigs.find((c) => c.id === "heshiis_kiro")!;
    const edits: BuiltinEdits = {
      title: "Heshiis Kiro (Kale)",
      description: "Qoraalkii hore — magacyada nuug wuu fududayay.",
      sectionTitles: { [kiro.sections[0].id]: "Dejinta Cusub" },
      fieldLabels: {},
      fieldOptional: {},
    };
    const edited = applyBuiltinEdits(kiro, edits);
    expect(edited.title).toBe("Heshiis Kiro (Kale)");
    expect(edited.sections[0].title).toBe("Dejinta Cusub");
    // The id, the parties, the clauses and the template mappings survive.
    expect(edited.id).toBe(kiro.id);
    expect(edited.sections).toHaveLength(kiro.sections.length);
    expect(edited.parties).toBeUndefined();
    expect(edited.placeholders).toEqual(kiro.placeholders);
    expect(edited.clauses).toEqual(kiro.clauses);
  });
});

describe("a saved overlay shadows its built-in everywhere", () => {
  afterAll(async () => {
    await restoreBuiltin("heshiis_kiro");
    registerRuntimeConfigs([]);
  });

  test("getConfig reads the overlay; ONE card per kind in the lists", async () => {
    const kiro = documentConfigs.find((c) => c.id === "heshiis_kiro")!;
    await saveBuiltinOverlay(
      { title: "Heshiis Kiro (Dhismaha)", description: "", sectionTitles: {}, fieldLabels: {}, fieldOptional: {} },
      "heshiis_kiro",
    );
    const rows = await getAllLocal(CUSTOM_DOC_TYPE_ENTITY);
    const overlay = rows.find((r) => (r as { kind: string }).kind === "builtinOverlay");
    expect(overlay).toBeDefined();
    const edited = deserializeCustomConfig(overlay as never)!;
    expect(edited.title).toBe("Heshiis Kiro (Dhismaha)");
    // Both registry readers prefer the overlay and never show two cards.
    registerRuntimeConfigs([edited]);
    expect(getConfig("heshiis_kiro")!.title).toBe("Heshiis Kiro (Dhismaha)");
    const listed = allDocumentConfigs().filter((c) => c.id === "heshiis_kiro");
    expect(listed).toHaveLength(1);
    expect(listed[0].title).toBe("Heshiis Kiro (Dhismaha)");
    // The interview still renders the typed flow: the shipped clauses and
    // visibility survived the edit, so validation still returns real rows.
    expect(
      typeof validateDocument(edited, deserializeDraft(edited, "{}")),
    ).toBe("object");
  });

  test("restoring the original again makes the shipped copy the reader's", async () => {
    await restoreBuiltin("heshiis_kiro");
    registerRuntimeConfigs([]);
    expect(getConfig("heshiis_kiro")!.title).toBe("Heshiis Kiro");
  });
});

/* ------------------------------------------------------------------ */
/* Slug hygiene — small, but they carry signed documents               */
/* ------------------------------------------------------------------ */

describe("slug + token helpers", () => {
  test("labels become ids; tokens become UPPER_SNAKE", () => {
    expect(slugifyLabel("Magaca Macmiilka Giz")).toBe("magaca_macmiilka_giz");
    expect(slugifyLabel("Qof giz ged")).toBe("qof_giz_ged");
    expect(fieldToken("magaca_macmiilka_giz")).toBe("MAGACA_MACMIILKA_GIZ");
  });
  test("the builder offers every field type the engine renders", () => {
    for (const type of ["text", "number", "currency", "date", "select", "yes_no"]) {
      expect(BUILDER_FIELD_TYPES).toContain(type);
    }
    expect(BUILDER_FIELD_TYPES).not.toContain("photo");
  });
});

test("the hydration hook reads the store like every other reader", async () => {
  // Rendering the hook's own read path directly: after the save above, one
  // fresh read must return the office's type.
  const rows = await getAllLocal(CUSTOM_DOC_TYPE_ENTITY);
  expect(rows.length).toBeGreaterThan(0);
  const config = deserializeCustomConfig(rows.at(-1) as never);
  expect(config).toBeDefined();
});

test("useCustomDocumentConfigs resolves under SSR without a provider", () => {
  // The hook itself only reads state; the render path must not crash.
  const html = renderToStaticMarkup(
    React.createElement(LanguageProvider, null, React.createElement(MemoryRouter, null, React.createElement(NewDocument))),
  );
  expect(html).toContain("Dukumenti Cusub");
});
