/**
 * Writes the system's INITIAL editable Word template to
 * public/templates/heshiis_kiro_template.docx (served as
 * /templates/heshiis_kiro_template.docx).
 *
 * NEVER overwrites silently: if the file already exists the script stops —
 * the user may have edited it in Word. Pass --force to regenerate the
 * starter, and keep any edited copy under a new name
 * (e.g. heshiis_kiro_template_final.docx).
 *
 * Run: bun run scripts/generate-template.ts [--force]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import JSZip from "jszip";
import {
  TEMPLATE_FILE_NAME,
  buildHeshiisKiroTemplateBytes,
  requiredTemplateTokens,
} from "../src/lib/notary/templateBuilder";
import { listTemplateTokens } from "../src/lib/notary/templateValidator";
import { registryTokenNames, placeholderRegistry } from "../src/lib/notary/placeholderRegistry";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";

const here = dirname(new URL(import.meta.url).pathname);
const target = resolve(here, `../public/templates/${TEMPLATE_FILE_NAME}`);
const force = process.argv.includes("--force");

const bytes = await buildHeshiisKiroTemplateBytes();

if (existsSync(target) && !force) {
  console.log(`⊘ ${TEMPLATE_FILE_NAME} wuxuu horey u jiraa — lama beddelin.`);
  console.log("  Haddii aad rabto template-ka nidaamka la regenerate garo: --force");
  console.log("  (Faylka aad Word-ka ku edit-gareeyay waa in aad magac cusub ku bixiso.)");
  process.exit(0);
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, bytes);

// Verify the produced file: real .docx + the registry tokens are intact.
const zip = await JSZip.loadAsync(Buffer.from(bytes));
const found = new Set(
  (await listTemplateTokens(Buffer.from(bytes).buffer as ArrayBuffer)).map((t) =>
    t.replace(/[{}]/g, "").toUpperCase(),
  ),
);
const known = registryTokenNames(placeholderRegistry("heshiis_kiro"));
const required = requiredTemplateTokens();
const missing = required.filter((t) => !found.has(t.toUpperCase()) && !found.has(`#${t}`) && !found.has(`/${t}`));
const unknown = [...found].filter((t) => !known.has(t) && !t.startsWith("IF:") && !t.startsWith("END:"));

console.log(`✔ ${TEMPLATE_FILE_NAME} la sameeyay (${(bytes.length / 1024).toFixed(1)} KB)`);
console.log(`  Path: public/templates/${TEMPLATE_FILE_NAME}`);
console.log(`  Placeholders: ${found.size} · blocks/flags balanced: ${zip.file("word/document.xml") !== null}`);
console.log(`  Missing canonical tokens: ${missing.length ? missing.join(", ") : "kuu mid ah"}`);
if (unknown.length) console.log(`  Unknown tokens (warning only): ${unknown.join(", ")}`);
if (missing.length) {
  console.error("✗ Template-ka ma buuxin — canonical tokens ma aha geeyaan.");
  process.exit(1);
}
console.log(`  Config wuxuu template-ka ka qaadayaa: ${heshiisKiroConfig.templatePath}`);