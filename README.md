# Notary Doc Builder — Contract Assembly for the Notary Office (Phase 1)

Notary Doc Builder is an internal web application for our office team. It
works like Docassemble but is purpose-built for **assembling and archiving
contracts**. Phase 1 supports one document type: **HESHIIS KIRO** (rental
contract: Guri Xaas, Qol Meherad, Jiingad).

Beyond document assembly, the workspace includes a searchable **archive**, a
**signing schedule**, a **team board** for office notices, **comments** on
every document, a **catalog** of ready and planned contract types, and an
**admin area** with a workspace-wide overview.

Workflow:

```
Document Type → Sub-Type → Dynamic Form → Validation → Word Template
→ Generated Document → Archive
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
| `/admin` | Workspace-wide overview and cleanup controls |
