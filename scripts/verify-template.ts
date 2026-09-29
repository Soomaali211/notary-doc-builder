/**
 * Phase 3 template pipeline verifier.
 *
 * Scenario A (#30): 2 kireeye, 3 kirayste, 4 marag, deebaaji Haa,
 * damiin Haa, $500, MUQADIN → all parties, clauses and wording appear.
 * Scenario B: deebaaji Maya + damiin Maya → those sections are removed
 * entirely (headings included) with no empty leftovers.
 *
 * Run: bun scripts/verify-template.ts  (after bun scripts/generate-templates.ts)
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { generateDocument } from "../src/lib/notary/pipeline";
import { selectTemplate } from "../src/lib/notary/registry";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";
import { scenarioA, scenarioB } from "./verify-helpers";
import type { FormValues } from "../src/lib/notary/types";

const here = dirname(fileURLToPath(import.meta.url));

async function documentText(values: FormValues): Promise<string> {
  const spec = selectTemplate(heshiisKiroConfig, values)!;
  // Bun script: read the registered template straight from /public.
  const bytes = readFileSync(resolve(here, `../public${spec.filePath}`));
  const out = await generateDocument({
    config: heshiisKiroConfig,
    values,
    referenceNumber: "DPN/K/001",
    subTypeLabel: "Guri Xaas",
    templateBytes: bytes,
    spec,
  });
  const buf = Buffer.from(await out.result.blob.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  return await zip.file("word/document.xml")!.async("string");
}

let ok = true;
const check = (name: string, pass: boolean) => {
  console.log(`${pass ? "✓" : "✗"} ${name}`);
  if (!pass) ok = false;
};

/* ---------------- Scenario A ---------------- */
const xmlA = await documentText(scenarioA());
check("Reference (source of truth, no auto-increment)", xmlA.includes("DPN/K/001"));
check("Somali date DD/MM/YYYY", xmlA.includes("29/09/2026"));
check("Currency $500", xmlA.includes("$500"));
check("2 kireeye (Faadumo Ali)", xmlA.includes("Faadumo Ali"));
check("3 kirayste (Liibaan Yusuf)", xmlA.includes("Liibaan Yusuf"));
check("4 marag numbered (4. Xasan Idle)", xmlA.includes("4. Xasan Idle"));
check("Deebaaji section present (Haa)", xmlA.includes("DEEQAJIGA"));
check("Damiin section present (Haa)", xmlA.includes("Maxamed Nuur"));
check("MUQADIN wording", xmlA.includes("MUQADIN"));
check("No leftover {{TOKEN}}", !/\{\{[A-Za-z0-9_#/]+(:[A-Za-z0-9_]+)?\}\}/.test(xmlA));
check("No leftover CLAUSE markers", !xmlA.includes("{{CLAUSE_"));

/* ---------------- Scenario B ---------------- */
const xmlB = await documentText(scenarioB());
check("Deebaaji section removed (Maya)", !xmlB.includes("DEEQAJIGA"));
check("Deebaaji heading removed", !xmlB.includes("5. DEEBAAJI"));
check("Damiin values removed (Maya)", !xmlB.includes("Maxamed Nuur"));
check("Damiin heading removed", !xmlB.includes("6. DAMIIN"));
check("Witness block still works in B", xmlB.includes("1. Asha Omar"));
check("No leftover tokens in B", !/\{\{[A-Za-z0-9_#/]+(:[A-Za-z0-9_]+)?\}\}/.test(xmlB));

/* ---------------- Filename & output path ---------------- */
const spec = selectTemplate(heshiisKiroConfig, scenarioA())!;
check("Template auto-selection by subtype", spec.templateId === "KIRO_GURI_XAAS_V1");
const out = await generateDocument({
  config: heshiisKiroConfig,
  values: scenarioA(),
  referenceNumber: "Ref/DPN/K/001",
  subTypeLabel: "Guri Xaas",
  templateBytes: readFileSync(resolve(here, `../public${spec.filePath}`)),
  spec,
});
check(
  "Filename Ref-DPN-K-001_Heshiis-Kiro_Guri-Xaas.docx",
  out.result.fileName === "Ref-DPN-K-001_Heshiis-Kiro_Guri-Xaas.docx",
);
check(
  "Output path output/Kiro/Guri_Xaas/",
  out.result.outputDocxPath === "output/Kiro/Guri_Xaas/Ref-DPN-K-001_Heshiis-Kiro_Guri-Xaas.docx",
);
check("Template metadata bound (V1)", out.result.templateId === "KIRO_GURI_XAAS_V1" && out.result.templateVersion === 1);
check("PDF unavailable → DOCX still generated", out.result.pdfAvailable === false && out.warnings.length > 0);

if (!ok) process.exit(1);
console.log("\nTemplate pipeline verified ✓");
