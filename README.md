# Notary Doc Builder — Contract Assembly for the Notary Office

Notary Doc Builder is an internal web application for our office team. It
works like Docassemble but is purpose-built for **assembling and archiving
contracts**. Phase 1 shipped the foundation (Heshiis Kiro end-to-end, DOCX
generation, archive). Phase 2 rebuilt the core as a **reusable, generic
Form / Interview Engine** — Heshiis Kiro is now just its first configuration.

Beyond document assembly, the workspace includes a searchable **archive**, a
**signing schedule**, a **team board** for office notices, **comments** on
every document, a **catalog** of ready and planned contract types, and an
**admin area** with a workspace-wide overview.

## Phase 2 — Dynamic Form & Interview Engine

```
Document Type → Sub-Type → Form Definition → Sections → Fields
→ Field Types → Validation Rules → Conditional Rules → Dynamic Repeaters
→ Interview State → Review
```

- **Field engine** (`types.ts`): text, textarea, number, currency, date,
  phone, email, select, radio, checkbox, multiselect, yes_no — each with
  label (Somali), description, default, placeholder, options, validation,
  order, and visibility rule. Technical ids never appear in the UI.
- **Validation engine** (`validation.ts`): required, min/max length,
  min/max value, pattern (+ custom Somali message), date, phone, email,
  date-range (`notBefore`), repeater minimum/maximum — errors appear next to
  their field, in Somali.
- **Conditional logic** (`conditions.ts`): equals, not_equals, greater_than,
  less_than, contains, is_empty, is_not_empty, is_true/is_false, and
  AND / OR / NOT composition. Evaluation is defensive — a malformed rule
  degrades to "hidden", never a crash.
- **Conditional sections AND fields**: a whole section (e.g. Damiinka)
  disappears from the interview, validation, and review when its rule is
  false. `requiredWhen` makes a visible field conditionally required.
- **Dynamic repeaters** (`formValues.ts`, `engine.ts`): arrays of row objects
  (never fixed seller_1/seller_2), each with `min` and optional `max`
  (omitted or 0 = unlimited), custom Somali minimum messages, and a delete
  confirmation dialog.
- **Interview state & drafts** (`engine.ts`): a plain-data state object
  (document type, subtype, current section, answers, errors, completed
  sections). Drafts serialize to JSON, merge over a fresh template on resume
  (config-safe), and corrupt payloads degrade gracefully. Statuses: draft,
  completed, generated, archived. Explicit "Save Draft" button plus autosave.
- **Review page**: per-section blocks with "Wax ka beddel" edit buttons that
  jump back to that section — no full restart.
- **Form engine API** (`engine.ts`): load_form, get_sections,
  get_visible_fields, evaluate_rules, validate_field/section/form,
  add/remove_repeatable_item, serialize/deserialize_draft, get_review_data —
  the UI talks only to this interface.
- **No hard-coding**: no `if document_type == "kiro"` anywhere. The engine is
  generic; Heshiis Kiro is pure configuration in `documents/heshiisKiro.ts`.
- **Tests** (`tests/engine.test.ts`): 37 automated tests covering fields,
  validation, conditional logic (AND/OR/NOT/nested), repeaters
  (add/remove/min/max/unlimited), draft round-trips, navigation state, and
  review data. Run with `bun test`.

Workflow:

```
Document Type → Sub-Type → Dynamic Form → Validation → Word Template
→ Generated Document → Archive
```

## Phase 3 — Template Engine & Document Generation

The generation core was rebuilt into a modular, block-aware template
engine. Word templates stay **designed by the office** — the system only
fills them, never redesigns them.

```
validate answers → Template Registry → validate template → data context
→ conditions → clauses → repeaters → placeholders → DOCX
→ output validation → (best-effort) PDF → archive metadata (immutable)
```

- **Template Registry & Loader** (`registry.ts`): one registered Word
  template per (document type, sub-type) — `KIRO_GURI_XAAS_V1`,
  `KIRO_QOL_MEHERAD_V1`, `KIRO_JIINGAD_V1`. Auto-selection by sub-type,
  config-driven, highest active version wins. Paths must come from the
  registry (`/templates/…`) — no arbitrary paths.
- **Template syntax** the office can use inside its Word templates:
  - `{{PLACEHOLDER}}` — plain replacement (case-insensitive)
  - `{{IF:FLAG}} … {{ENDIF}}` — conditional section; false removes the
    whole block **including headings**
  - `{{#BLOCK}} … {{/BLOCK}}` — repeated once per party row (multiline,
    paragraph-per-marker) or inline in one line (rows joined with " · ")
  - `{{CLAUSE_*}}` — conditional clause markers resolved by the engine
- **Condition flags & repeat blocks** are pure config:
  `conditionFlags` (DEEBAAJI_HAA, DAMIIN_HAA, MUQADIN, MUAKHIR) and
  `repeatBlocks` (MARAGYO with PHONE/ID aliases, KIREYEYAYAAL,
  KIRAYSTAYAAL). Formatting (date `DD/MM/YYYY`, currency `$`) lives in
  `config.format`.
- **Formatting-preserving renderer** (`docxRenderer.ts`): paragraphs,
  table cells, headers and footers are processed while keeping the first
  run's formatting (bold/italic/font/size). Somali words-numbers support
  (`somaliNumbers.ts`) for `currency_words` format.
- **Template Validator** (`templateValidator.ts`): exists/readable,
  placeholder syntax, unknown mappings, IF + repeat balance — a broken
  template throws *before* any document is produced. The same validator
  powers the Admin → Template validation screen (checklist ✓/✗).
- **Archive immutability**: a GENERATED document is never overwritten.
  Regeneration = `cloneAsDraft` → fresh draft carrying the answers → the
  user edits and generates a **new version**. Metadata (template id +
  version + output paths) is stored with every generation
  (`generatedMetadata`, `supersededBy`).
- **PDF abstraction** (`pdfRenderer.ts`): `convertToPdf` is a stub that
  returns `null`; the pipeline is best-effort — the DOCX is always
  produced and a warning explains PDF is not yet wired. Ready for
  LibreOffice/cloud API wiring (Phase 4).
- **Reference numbers**: the user-entered reference is the source of
  truth — no auto-increment. Filenames sanitize to
  `Ref-DPN-K-001_Heshiis-Kiro_Guri-Xaas.docx` under
  `output/Kiro/Guri_Xaas/`.

Verify / regenerate commands:

```bash
bun scripts/generate-templates.ts   # recreate the 3 sample .docx templates
bun scripts/verify-template.ts      # 22-check pipeline verification (2 scenarios)
bun test tests/engine.test.ts       # Phase 2 engine (37 tests)
bun test tests/generation.test.ts   # Phase 3 generation matrix (32 tests)
```

## Waxa Phase 1 uu qabto

- ✅ Document selection: Heshiis Kiro + sub-types (Guri Xaas / Qol Meherad / Jiingad)
- ✅ Guided interview 10 sections ah: Heshiiska, Kireeyaha, Kiraystaha,
  Faahfaahinta Guriga, Lacagta & Habka Bixinta, Deebaaji, Damiinka,
  Ogaysiinta, Maragyada, Dheeraad ah
- ✅ Next/Back navigation + progress (`2/10`)
- ✅ **Dynamic parties** — "Ku dar Kireeye / Kirayste / Marag" + Remove
  (tirada ma hard-coded na)
- ✅ **Conditional logic** — Deebaaji Haa/Maya, Damiin Haa/Maya,
  faahfaahin dheeraad ah (fields-ka qarsoon marka "Maya")
- ✅ Validation Somali: required fields, taariikhho sax ah,
  end date ≥ start date, lacag sax ah, telefoon, ugu yaraan 1 marag
- ✅ Review page ka hor generation
- ✅ **DOCX generation** ka template-kaaga Word
  (`public/templates/heshiis_kiro_template.docx`) — system-ku wuxuu KALIYA
  buuxinayaa `{{PLACEHOLDERS}}`-ka; design-ka wuxuu iska lehahay xafiiska
- ✅ Somali date (`15 Janaayo 2026`) iyo currency formatting (`35,000 USD`)
- ✅ Conditional clauses: Deebaaji = Maya → clause lama gelin; Damiin = Haa →
  clause + xogta damiinka; 3 marag → 3 marag oo dhan oo automatic ah
- ✅ Archive (Convex database): ID, Reference Number, Document Type, Sub-Type,
  Date, Parties, File, Created/Updated At, Status + Search / Filter / Open /
  Download
- ✅ Safe file naming (`Ref-DPN-K-001_Heshiis-Kiro.docx`), input validation,
  rollback-safe generation (draft-ka luma marka generation fashilmo)
- ✅ PDF: Phase 1 waxay si buuxda u taageertaa DOCX; PDF converter (LibreOffice
  ama cloud API) waa Phase 2 — bogga `convertToPdf` ee
  `src/lib/notary/template.ts` ayaa diyaar u ah isku xirka.

## Architecture (modular, extensible)

```
Document Types (config registry)
      ↓
Form Configuration  (src/lib/notary/documents/*.ts)
      ↓
Fields + Sections   (types.ts)
      ↓
Conditional Rules   (conditions.ts — rules engine)
      ↓
Validation          (validation.ts — Somali errors)
      ↓
Clauses             (template.ts — conditional DOCX blocks)
      ↓
Template Mapping    (placeholders per document config)
      ↓
Document Generator  (template.ts — JSZip DOCX filler)
      ↓
Archive             (Convex: notary_documents + file storage)
```

Engine-ku **ma ku xirna** Heshiis Kiro. Document type cusub (Heshiis Deyn,
Wakiilnimo, Kala Iibsi Hanti, Cadayn Cilaaj, Heshiis Shirkadeed) waa inaan
dhisaa `DocumentConfig` cusub oo lagu daro `src/lib/notary/documents/index.ts`
— UI, validation, iyo generation code lama bedelin.

## Sample configuration

`src/lib/notary/documents/heshiisKiro.ts` waa sample configuration oo dhan:
10 sections, party definitions (kireeyayaal, kiraystayaal, maragyo),
conditional fields (`visibleWhen`), placeholders, iyo clauses.

## Sample Word template mapping

Placeholder-ada template-ka waxay xirmaan form fields sida tan:

| Placeholder | Form field | Format |
|---|---|---|
| `{{REFERENCE_NUMBER}}` | `heshiiska.reference` | text |
| `{{CONTRACT_DATE}}` | `heshiiska.taariikhda_heshiiska` | Somali date |
| `{{KIREYE_MAGAC}}` | `kireeyayaal.magac` (kowaad) | text |
| `{{KIRAYSTE_MAGAC}}` | `kiraystayaal.magac` (kowaad) | text |
| `{{QIIMAHA_KIRADA}}` | `lacagta.qiimaha_bil_ka` | currency |
| `{{TAARIIKHDA_BILOWGA}}` | `heshiiska.taariikhda_bilowga` | Somali date |
| `{{DEEBAAJI_AMOUNT}}` | `deebaaji.lacagta_deebaajiga` | currency |
| `{{MARAGYO_LIST}}` | dhammaan maragyada (dynamic) | joined lines |
| `{{KIREYEYAYAAL_LIST}}` | dhammaan kireeyayaasha | joined |
| `{{CLAUSE_DEEBAAJI}}` | conditional block | clause |
| `{{CLAUSE_DAMIIN}}` | conditional block | clause |

**Si aad u beddesho template-kaaga design-gaaga:** fur
`public/templates/heshiis_kiro_template.docx` Word, sax design-ka, laakiin
**dayn** placeholder-ada. Kadib system-ku wuxuu weli buuxin doonaa si sax ah.
(Liiska buuxa: `scripts/generate-template.ts` ama config-ka `placeholders`.)

Dib-u-abuurista sample template-ka:

```bash
bun scripts/generate-template.ts
```

## Setup instructions

```bash
# 1. Install dependencies
bun install

# 2. Convex backend (codegen + push)
bun convex dev --once

# 3. Run the app (Freebuff runs the dev server automatically;
#    locally: bun run dev)

# 4. (Optional) regenerate the sample Word template
bun scripts/generate-template.ts
```

Typecheck:

```bash
bun tsc -b --noEmit
```

## Security & Data Integrity

- Input validation labada dhinac (client + Convex mutation guards)
- Safe file naming (xaraf aan sax ahayn lama ogola, path traversal ma jiro)
- JSON parse-check + size cap ka hor kaydinta
- Ownership checks (user kastaa wuxuu arkaa kaliya dukumeentiyadiisa)
- Generation-ku waa rollback-safe: DOCX-ga waxaa la dhisaa browser-ka, haddii
  upload/commit fashilmo draft-ka iyo xogta user-ka way kaydsan yihiin
- `notary_counters` wuxuu bixiyaa reference numbers nidaamsan
  (`DPN-K-001`, `DPN-K-002`, …)

## Pages

| Route | What it does |
|---|---|
| `/` | Landing page (notebook theme) |
| `/auth` | Sign in / sign up (email code or guest) |
| `/dashboard` | Workspace overview — stats, areas, recent documents, upcoming signings |
| `/new` | Choose document type + sub-type |
| `/documents/:docId` | The guided interview (10 steps) + review & generate |
| `/archive` | Archive (search / filter / open) |
| `/archive/:docId` | Document detail: parties, stored answers, DOCX download, comments |
| `/catalog` | Browse all document types — ready and planned |
| `/schedule` | Book and manage signing appointments |
| `/board` | Team board — short internal posts |
| `/admin` | Workspace-wide overview, template validation checklist, cleanup controls |
