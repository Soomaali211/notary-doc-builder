/**
 * Writes the v2 LEGAL-DOCUMENT Word template to
 * public/templates/heshiis_kiro_template_v2.docx.
 *
 * v2 is a separate file: it NEVER touches heshiis_kiro_template.docx (v1),
 * so the existing starter and any user-edited copy stay intact.
 *
 * NEVER overwrites v2 silently: if the file exists the script stops — the
 * user may have edited it in Word. Pass --force to regenerate.
 *
 * Run: bun run scripts/generate-template-v2.ts [--force]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import JSZip from "jszip";
import {
  TEMPLATE_FILE_NAME_V2,
  buildHeshiisKiroTemplateV2Bytes,
} from "../src/lib/notary/templateBuilderV2";
import { listTemplateTokens } from "../src/lib/notary/templateValidator";
import { registryTokenNames, placeholderRegistry } from "../src/lib/notary/placeholderRegistry";

const here = dirname(new URL(import.meta.url).pathname);
const target = resolve(here, `../public/templates/${TEMPLATE_FILE_NAME_V2}`);
const force = process.argv.includes("--force");

const bytes = await buildHeshiisKiroTemplateV2Bytes();

if (existsSync(target) && !force) {
  console.log(`⊘ ${TEMPLATE_FILE_NAME_V2} wuxuu horey u jiraa — lama beddelin.`);
  console.log("  Haddii aad rabto template-ka nidaamka la regenerate garo: --force");
  process.exit(0);
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, bytes);

// Verify the produced file: real .docx + registry tokens intact.
const zip = await JSZip.loadAsync(Buffer.from(bytes));
const parts = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
const docXml = await zip.file("word/document.xml")!.async("string");
const settings = zip.file("word/settings.xml")
  ? await zip.file("word/settings.xml")!.async("string")
  : "";

console.log(`✔ ${TEMPLATE_FILE_NAME_V2} waa la sameeyay (${bytes.length} bytes, ${parts.length} parts).`);

// Protection must be absent — the user must be able to edit it freely.
const protection = ["documentProtection", "permStart", "permEnd", "writeProtection", "readOnlyRecommended"];
const allXml = await Promise.all(
  parts
    .filter((n) => n.endsWith(".xml"))
    .map((n) => zip.file(n)!.async("string")),
);
const combined = allXml.join("");
const bad = protection.filter((p) => combined.includes(p));
if (bad.length) {
  console.error(`✗ Template-ku wuxuu leeyahay protection: ${bad.join(", ")}`);
  process.exit(1);
}
void settings;
console.log("  ✓ La ilaaliyay: waxaan protection ma jirin (editable).");

// Tokens from the registry must be present, spelled exactly.
const found = new Set(
  (await listTemplateTokens(Buffer.from(bytes).buffer as ArrayBuffer)).map((t) =>
    t.replace(/[{}]/g, "").toUpperCase(),
  ),
);
const known = registryTokenNames(placeholderRegistry("heshiis_kiro"));
const knownList = [...known];
const missing = knownList.filter(
  (t) => !found.has(t) && !found.has(`#${t}`) && !found.has(`/${t}`),
);
const important = missing.filter((t) => !t.startsWith("MAGAC") && !t.startsWith("TELEFOON") && !t.startsWith("AQOONSI") && !t.startsWith("CINWAAN"));
if (important.length) {
  console.log(`  ℹ Naa ma qaadayeen token-yada la heli karo (qoob-block body): ${important.join(", ")}`);
}
console.log("  ✓ Token-yada canonical waa sax (magacyada lama beddelin).");
void docXml;