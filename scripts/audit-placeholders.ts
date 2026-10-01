/**
 * PLACEHOLDER AUDIT — cross-checks the REAL DOCX template against the
 * system's canonical tokens, condition flags, repeat blocks and row tokens.
 *
 * Run: bun run scripts/audit-placeholders.ts
 *
 * Prints a table:  TEMPLATE TOKEN | SYSTEM TOKEN | STATUS
 * and exits 1 when a required placeholder is unknown to the system.
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { resolve } from "node:path";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";
import { buildDataContext } from "../src/lib/notary/dataContext";
import { getConfig } from "../src/lib/notary/documents";
import { knownPlaceholderNames } from "../src/lib/notary/dataContext";
import { HESHIIS_KIRO_PLACEHOLDERS, tokenString } from "../src/lib/notary/placeholderRegistry";
import type { FormValues } from "../src/lib/notary/types";
import { scenarioA } from "./verify-helpers";

const TEMPLATE = resolve(
  process.cwd(),
  "public/templates/heshiis_kiro_template_v2.docx",
);

/* ---------------- STEP 1 — scan the real DOCX ---------------- */

function readZip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const parts = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    const lhName = buf.readUInt16LE(localOff + 26);
    const lhExtra = buf.readUInt16LE(localOff + 28);
    const s = localOff + 30 + lhName + lhExtra;
    const raw = buf.subarray(s, s + compSize);
    parts.set(name, method === 0 ? raw : inflateRawSync(raw));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return parts;
}

const bytes = readFileSync(TEMPLATE);
const parts = readZip(bytes);
const docXml = parts.get("word/document.xml")!.toString("utf8");
const visibleText = (docXml.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? [])
  .map((t) => t.replace(/<[^>]+>/g, ""))
  .join("\n");

const rawTokens = [...visibleText.matchAll(/\{\{([^}]*)\}\}/g)].map((m) =>
  m[1].trim(),
);
const templateTokens = [...new Set(rawTokens)].sort();

console.log("=".repeat(78));
console.log("STEP 1 — TEMPLATE SCAN (public/templates/heshiis_kiro_template_v2.docx)");
console.log("=".repeat(78));
console.log(`Total token occurrences: ${rawTokens.length}`);
console.log(`Unique tokens: ${templateTokens.length}\n`);

/* ---------------- STEP 2 — scan the system ---------------- */

const config = getConfig("heshiis_kiro")!;

// Canonical registry entries.
const registryCanonical = new Map<string, string>(); // token -> kind
for (const s of HESHIIS_KIRO_PLACEHOLDERS) {
  registryCanonical.set(s.token.toUpperCase(), s.kind ?? "placeholder");
  for (const a of s.aliases ?? []) registryCanonical.set(a.toUpperCase(), "alias");
}

// Flags the system can actually evaluate.
const configFlags = new Set(
  Object.keys(heshiisKiroConfig.conditionFlags ?? {}).map((f) => f.toUpperCase()),
);
// Flags derived from attendance by resolveFlags().
const attendanceFlags = new Set<string>();
for (const p of heshiisKiroConfig.sections.flatMap((s) => s.parties ?? [])) {
  if (!p.attendance) continue;
  const group = p.singular.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  attendanceFlags.add(`${group}_JOOGA`);
  attendanceFlags.add(`${group}_WAKIIL`);
}
const knownFlags = new Set([...configFlags, ...attendanceFlags]);

// Repeat blocks.
const knownBlocks = new Set(
  (heshiisKiroConfig.repeatBlocks ?? []).map((b) => b.blockId.toUpperCase()),
);

// Row-scoped tokens: what each block body may use.
const rowTokens = new Set<string>(["NUMBER", "JOOGA", "WAKIIL", "MAGAC", "TELEFOON", "AQOONSI", "CINWAAN", "PHONE", "ID", "MATALAYA", "WAKIIL_MAGAC", "WAKIIL_TELEFOON", "WAKIIL_AQOONSI", "WAKIIL_CINWAAN"]);
for (const p of heshiisKiroConfig.sections.flatMap((s) => s.parties ?? [])) {
  if (!p.attendance) continue;
  for (const f of p.representativeFields ?? []) {
    rowTokens.add(`WAKIIL_${f.id.toUpperCase()}`);
  }
  for (const f of p.fields ?? []) rowTokens.add(f.id.toUpperCase());
}
for (const f of (heshiisKiroConfig.sections.find((s) => s.id === "maragyada")?.parties ?? []).flatMap((p) => p.fields ?? [])) {
  rowTokens.add(f.id.toUpperCase());
}

// Document-level tokens the context can resolve.
const values = scenarioA();
const ctx = buildDataContext(config, values);
const docTokens = new Set<string>();
for (const [k, v] of Object.entries(ctx.replacements ?? {})) {
  if (typeof v === "string") docTokens.add(k.replace(/[{}]/g, "").toUpperCase());
}

console.log("=".repeat(78));
console.log("STEP 2 — SYSTEM SCAN");
console.log("=".repeat(78));
console.log(`Registry entries:        ${HESHIIS_KIRO_PLACEHOLDERS.length}`);
console.log(`Canonical + alias names: ${registryCanonical.size}`);
console.log(`Condition flags:         ${[...configFlags].sort().join(", ")}`);
console.log(`Attendance flags:        ${[...attendanceFlags].sort().join(", ")}`);
console.log(`Repeat blocks:           ${[...knownBlocks].sort().join(", ")}`);
console.log(`Row-scoped tokens:       ${[...rowTokens].sort().join(", ")}\n`);

/* ---------------- STEP 3 — compare ---------------- */

type Status =
  | "MATCH"
  | "ALIAS"
  | "MISSING_FROM_TEMPLATE"
  | "UNKNOWN_IN_TEMPLATE"
  | "INVALID_SYNTAX";

interface Row {
  template: string;
  system: string;
  status: Status;
  note: string;
}

const rows: Row[] = [];

// Row-scoped flags are only valid INSIDE their repeat block, so the audit
// has to know which block each token sits in (same rule the validator uses).
const occurrences = rawTokens.map((t) => t.toUpperCase());
function enclosingBlock(upTo: number): string | null {
  const stack: string[] = [];
  for (let i = 0; i < upTo; i++) {
    const t = occurrences[i];
    if (t.startsWith("#")) stack.push(t.slice(1));
    else if (t.startsWith("/")) stack.pop();
  }
  return stack.length ? stack[stack.length - 1] : null;
}

// 3a — every token the template uses.
templateTokens.forEach((raw, _idx) => {
  const t = raw.toUpperCase();
  const block = enclosingBlock(occurrences.indexOf(t));

  // structural markers
  if (t.startsWith("IF:") || t.startsWith("END:")) {
    const flag = t.startsWith("IF:") ? t.slice(3) : t.slice(4);
    const global = knownFlags.has(flag);
    // A row-scoped flag (JOOGA / WAKIIL) is valid inside its repeat block.
    const rowScoped = !!block && rowTokens.has(flag);
    const ok = global || rowScoped;
    rows.push({
      template: `{{${raw}}}`,
      system: global
        ? `flag ${flag}`
        : rowScoped
          ? `row flag ${flag} in {{#${block}}}`
          : "—",
      status: ok ? "MATCH" : "UNKNOWN_IN_TEMPLATE",
      note: ok
        ? rowScoped && !global
          ? "row-scoped conditional"
          : "document conditional"
        : block
          ? `no flag ${flag} (not row-scoped inside {{#${block}}})`
          : "system has no such flag",
    });
    return;
  }
  if (t.startsWith("#") || t.startsWith("/")) {
    const name = t.replace(/^[#/]/, "");
    rows.push({
      template: `{{${raw}}}`,
      system: knownBlocks.has(name) ? `block ${name}` : "—",
      status: knownBlocks.has(name) ? "MATCH" : "UNKNOWN_IN_TEMPLATE",
      note: "repeat marker",
    });
    return;
  }

  // plain token
  const canonical = registryCanonical.get(t);
  if (canonical === "alias") {
    rows.push({
      template: `{{${raw}}}`,
      system: `alias of ${[...registryCanonical].find(([, k]) => k === "alias" && [...registryCanonical.keys()].includes(t)) ? "canonical" : "?"}`,
      status: "ALIAS",
      note: "accepted, resolves to the canonical value",
    });
    return;
  }
  if (canonical) {
    rows.push({
      template: `{{${raw}}}`,
      system: `${canonical} ${t}`,
      status: "MATCH",
      note: docTokens.has(t) ? "resolves to a value" : "registry only (no value in this fixture)",
    });
    return;
  }
  if (rowTokens.has(t)) {
    rows.push({
      template: `{{${raw}}}`,
      system: `row token ${t}`,
      status: "MATCH",
      note: "valid inside a repeat block",
    });
    return;
  }
  rows.push({
    template: `{{${raw}}}`,
    system: "—",
    status: "UNKNOWN_IN_TEMPLATE",
    note: block ? `not a row token of {{#${block}}}` : "system does not know this name",
  });
});

// 3b — canonical entries the template never mentions.
for (const [name, kind] of [...registryCanonical].sort()) {
  if (kind === "alias") continue;
  if (templateTokens.some((t) => t.toUpperCase() === name)) continue;
  rows.push({
    template: "—",
    system: `${kind} ${name}`,
    status: "MISSING_FROM_TEMPLATE",
    note: "available in the registry but unused by this template",
  });
}

// 3c — flags/blocks the system supports but the template never uses.
for (const f of [...knownFlags].sort()) {
  if (templateTokens.some((t) => t.toUpperCase().endsWith(`:${f}`))) continue;
  rows.push({
    template: "—",
    system: `flag ${f}`,
    status: "MISSING_FROM_TEMPLATE",
    note: "system flag unused by this template",
  });
}

console.log("=".repeat(78));
console.log("STEP 3 — COMPARISON TABLE");
console.log("=".repeat(78));
const w1 = 30;
const w2 = 26;
console.log(
  "TEMPLATE TOKEN".padEnd(w1) + "SYSTEM TOKEN".padEnd(w2) + "STATUS".padEnd(24) + "NOTE",
);
console.log("-".repeat(120));
for (const r of rows) {
  console.log(
    r.template.padEnd(w1) +
      r.system.padEnd(w2) +
      r.status.padEnd(24) +
      r.note,
  );
}

const bad = rows.filter(
  (r) => r.status === "UNKNOWN_IN_TEMPLATE" || r.status === "INVALID_SYNTAX",
);
console.log("\n" + "=".repeat(78));
console.log(
  `SUMMARY: ${rows.length} rows · ${rows.filter((r) => r.status === "MATCH").length} MATCH · ` +
    `${rows.filter((r) => r.status === "ALIAS").length} ALIAS · ` +
    `${rows.filter((r) => r.status === "MISSING_FROM_TEMPLATE").length} MISSING_FROM_TEMPLATE · ` +
    `${bad.length} UNKNOWN/INVALID`,
);
console.log("=".repeat(78));

if (bad.length) {
  console.log("\nUNKNOWN tokens (generation would silently drop these):");
  for (const b of bad) console.log(`  ✗ ${b.template}  ${b.note}`);
  process.exit(1);
}
console.log("\n✓ Every template token is known to the system.");
void tokenString;