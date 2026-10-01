/**
 * Template Compatibility Validator.
 *
 * Answers one question before generation: "will this user's .docx fill in
 * correctly, and if not, exactly where does it break?"
 *
 * Every token found in the uploaded file is classified with ONE status:
 *
 *   MATCH                  system knows the name; the token resolves
 *   ALIAS                  the template used an older alias; it still resolves
 *                          to the canonical name (reported, never an error)
 *   UNKNOWN_IN_TEMPLATE    the SYSTEM produced this name but the template
 *                          never uses it (informational — a placeholder the
 *                          document will leave empty)
 *   INVALID_SYNTAX         the token itself is malformed or structurally broken
 *
 * The audit script (scripts/audit-placeholders.ts) and the Template Manager
 * both read the SAME name list (knownPlaceholderNames + placeholderRegistry),
 * so the audit table shown here and the table printed by the script can never
 * disagree about what the system knows.
 *
 * Blocking rules (deliberately narrow):
 *   - invalid syntax / unbalanced conditionals / unknown repeaters  → BLOCK
 *   - unknown tokens                                               → warning only
 *     (the user owns the template; unknown tokens are stripped, not fatal)
 *   - missing canonical tokens                                     → never blocks
 */

import type { DocumentConfig } from "./types";
import { knownPlaceholderNames } from "./dataContext";
import {
  canonicalNameFor,
  placeholderRegistry,
  type PlaceholderSpec,
} from "./placeholderRegistry";
import { extractTemplateTokenStream } from "./templateValidator";

export { extractTemplateTokenStream };

export type TokenStatus =
  | "MATCH"
  | "ALIAS"
  | "MISSING_FROM_TEMPLATE"
  | "UNKNOWN_IN_TEMPLATE"
  | "INVALID_SYNTAX";

export type TokenKind =
  | "placeholder"
  | "flag"
  | "block_open"
  | "block_close"
  | "clause"
  | "row_token"
  | "structural";

export interface TokenClassification {
  /** Exactly as the user typed it, e.g. "{{KIREYE_MAGAC}}". */
  token: string;
  /** Normalized name without braces and any IF:/END:/#// prefix. */
  name: string;
  kind: TokenKind;
  status: TokenStatus;
  /** Canonical name this token resolves to (differs from `name` for ALIAS). */
  canonical?: string;
  /** Somali explanation shown in the Template Manager. */
  detail?: string;
  /** Repeat block this token sits inside, when any. */
  block?: string;
}

export interface CompatibilityReport {
  /** One row per distinct token, in document order. */
  classifications: TokenClassification[];
  /** Tokens the system fills in (MATCH + ALIAS). */
  recognized: string[];
  /** Tokens the system does NOT know — warning, never blocking. */
  unknown: string[];
  /** System names the template never uses — informational. */
  unused: { token: string; status: "MISSING_FROM_TEMPLATE" }[];
  /** Alias → canonical mappings so the user can modernize his template. */
  aliasMappings: { token: string; canonical: string }[];
  /** Structural problems — these block generation. */
  invalidConditionals: string[];
  invalidRepeaters: string[];
  invalidSyntax: string[];
  /** False only when a structural problem would corrupt the document. */
  canGenerate: boolean;
  /** Every blocking message, Somali. */
  blocking: string[];
}

const TOKEN_PATTERN = /^(IF:[A-Za-z0-9_]+|ENDIF|END:[A-Za-z0-9_]+|#[A-Za-z0-9_]+|\/[A-Za-z0-9_]+|[A-Za-z0-9_.]+)$/;

function strip(name: string): string {
  return name.replace(/[{}]/g, "").trim().toUpperCase();
}

/** Row tokens a repeat block legitimately exposes inside its body. */
function rowTokensFor(config: DocumentConfig, blockId: string): Set<string> {
  const id = blockId.toUpperCase();
  const mapping = (config.repeatBlocks ?? []).find(
    (b) => b.blockId.toUpperCase() === id,
  );
  const names = new Set<string>(["NUMBER"]);
  if (!mapping) return names;
  for (const alias of Object.keys(mapping.aliases ?? {})) {
    names.add(alias.toUpperCase());
  }
  const partyDef = config.sections
    .flatMap((s) => s.parties ?? [])
    .find((p) => p.id === mapping.partyId);
  for (const f of partyDef?.fields ?? []) names.add(f.id.toUpperCase());
  if (partyDef?.attendance) {
    names.add("JOOGA");
    names.add("WAKIIL");
    names.add("MATALAYA");
    for (const f of partyDef.representativeFields ?? []) {
      names.add(`WAKIIL_${f.id.toUpperCase()}`);
    }
  }
  return names;
}

/**
 * Classify the token stream of an uploaded .docx.
 *
 * `tokenStream` is passed in (not the bytes) so tests can drive the validator
 * with a plain array and never build a zip.
 */
export function classifyTemplateTokens(
  tokenStream: string[],
  config: DocumentConfig,
): CompatibilityReport {
  const known = knownPlaceholderNames(config);
  const specs: PlaceholderSpec[] = placeholderRegistry(config.id);
  const blockIds = new Set(
    (config.repeatBlocks ?? []).map((b) => b.blockId.toUpperCase()),
  );
  const clauseNames = new Set(
    config.clauses.map((c) => strip(c.placeholder)),
  );

  const classifications: TokenClassification[] = [];
  const aliasMappings: { token: string; canonical: string }[] = [];
  const invalidConditionals: string[] = [];
  const invalidRepeaters: string[] = [];
  const invalidSyntax: string[] = [];
  const usedNames = new Set<string>();

  const push = (c: TokenClassification) => {
    classifications.push(c);
    usedNames.add(c.name);
  };

  const ifStack: string[] = [];
  const blockStack: string[] = [];

  for (const raw of tokenStream) {
    // Callers differ: the docx reader yields the INNER text ("KIREYE_MAGAC")
    // while a text fixture may yield the full "{{KIREYE_MAGAC}}". Strip
    // braces once here so both entry points classify identically.
    const name = strip(raw);
    const token = name;
    const block = blockStack[blockStack.length - 1];
    const rowTokens = block ? rowTokensFor(config, block) : null;

    if (!TOKEN_PATTERN.test(name)) {
      invalidSyntax.push(
        `Syntax aan sax ahayn: {{${token}}} — token-ku wuxuu u baahan yahay {{MAGAC}} ama {{IF:FLAG}} ama {{#BLOCK}} sidaas ah.`,
      );
      push({
        token: `{{${token}}}`,
        name,
        kind: "structural",
        status: "INVALID_SYNTAX",
        detail: "Qaab syntax-ka aan sax ahayn.",
        block,
      });
      continue;
    }
    // The name is already normalized; build the {{…}} form once.

    /* ---- {{#BLOCK}} / {{/BLOCK}} ---- */
    if (name.startsWith("#") || name.startsWith("/")) {
      const id = name.slice(1);
      const isOpen = name.startsWith("#");
      if (!blockIds.has(id)) {
        const message = `Block-ka aan la aqoon: {{${name}}} — system-ku ma aqoonto {{#${id}}}.`;
        invalidRepeaters.push(message);
        invalidSyntax.push(message);
        push({
          token: `{{${token}}}`,
          name,
          kind: isOpen ? "block_open" : "block_close",
          status: "INVALID_SYNTAX",
          detail: "Block-ka aan la aqoon.",
          block,
        });
        continue;
      }
      if (isOpen) blockStack.push(id);
      else blockStack.pop();
      push({
        token: `{{${token}}}`,
        name,
        kind: isOpen ? "block_open" : "block_close",
        status: "MATCH",
        canonical: id,
        detail: `Block-ka ${id} waa la aqoon.`,
        block,
      });
      continue;
    }

    /* ---- {{IF:FLAG}} … {{END:FLAG}} ---- */
    if (name.startsWith("IF:")) {
      const flag = name.slice(3);
      // A flag is legal if it is a global condition flag (config or the
      // attendance-derived set) OR a row-scoped flag of the enclosing block.
      const legal = known.has(flag) || (rowTokens?.has(flag) ?? false);
      ifStack.push(flag);
      if (!legal) {
        const message = `Flag aan la aqoon: {{IF:${flag}}} — system-ku ma aqoonto xaalad-da "${flag}".`;
        invalidConditionals.push(message);
        push({
          token: `{{${token}}}`,
          name,
          kind: "flag",
          status: "INVALID_SYNTAX",
          detail: "Xaalad (flag) aan la aqoon.",
          block,
        });
        continue;
      }
      push({
        token: `{{${token}}}`,
        name: flag,
        kind: "flag",
        status: "MATCH",
        canonical: flag,
        detail: rowTokens?.has(flag)
          ? `Xaalad-unug: ${flag} (${block} hal unug gudihiisa).`
          : `Xaaladda ${flag} waa la aqoon.`,
        block,
      });
      continue;
    }
    if (name === "ENDIF" || name.startsWith("END:")) {
      const opened = ifStack.pop();
      const closed = name === "ENDIF" ? undefined : name.slice(4);
      if (opened === undefined) {
        const message = `{{${token}}} lama xirin {{IF:}} gudihiisa.`;
        invalidConditionals.push(message);
        push({
          token: `{{${token}}}`,
          name,
          kind: "structural",
          status: "INVALID_SYNTAX",
          detail: message,
          block,
        });
        continue;
      }
      if (closed !== undefined && closed !== opened) {
        const message = `{{IF:${opened}}} waxaa loo xireyay {{END:${closed}}} — labadu wadar ma isku ekaan.`;
        invalidConditionals.push(message);
        push({
          token: `{{${token}}}`,
          name,
          kind: "structural",
          status: "INVALID_SYNTAX",
          detail: message,
          block,
        });
        continue;
      }
      push({
        token: `{{${token}}}`,
        name,
        kind: "structural",
        status: "MATCH",
        canonical: opened,
        detail: `Xarfaha {{IF:${opened}}} waa la xireeyay.`,
        block,
      });
      continue;
    }

    /* ---- Plain {{TOKEN}} ---- */
    // A row token used INSIDE its block is a MATCH; the same name in plain
    // body text is not resolvable and must not be silently accepted.
    if (rowTokens?.has(name)) {
      push({
        token: `{{${token}}}`,
        name,
        kind: "row_token",
        status: "MATCH",
        canonical: name,
        detail: `Unug-ka ${block} hal saf gudihiisa.`,
        block,
      });
      continue;
    }

    const canonical = canonicalNameFor(specs, name);
    if (canonical && canonical !== name) {
      aliasMappings.push({ token: `{{${token}}}`, canonical: `{{${canonical}}}` });
      push({
        token: `{{${token}}}`,
        name,
        kind: "placeholder",
        status: "ALIAS",
        canonical,
        detail: `Waxay la mid ah {{${canonical}}}.`,
        block,
      });
      continue;
    }

    if (known.has(name) || clauseNames.has(name)) {
      push({
        token: `{{${token}}}`,
        name,
        kind: clauseNames.has(name) ? "clause" : "placeholder",
        status: "MATCH",
        canonical: name,
        detail: "System-ku wuxuu yaqaan magacan.",
        block,
      });
      continue;
    }

    // The template uses a name the system does not know. Warning only: the
    // token is stripped from the finished document, generation continues.
    push({
      token: `{{${token}}}`,
      name,
      kind: "placeholder",
      status: "UNKNOWN_IN_TEMPLATE",
      detail:
        "System-ku ma aqoonto magacan — token-ka wuxuu xarfahooda ka baxsan doonaa document-ka.",
      block,
    });
  }

  /* ---- Unclosed markers ---- */
  for (const flag of ifStack) {
    invalidConditionals.push(
      `{{IF:${flag}}} lama xirin — {{END:${flag}}} maqan.`,
    );
  }
  for (const id of blockStack) {
    invalidRepeaters.push(`{{#${id}}} lama xirin — {{/${id}}} maqan.`);
  }

  /* ---- Names the system knows but the template never uses ---- */
  const unused = [...known]
    .filter((n) => !usedNames.has(n))
    .sort()
    .map((n) => ({ token: `{{${n}}}`, status: "MISSING_FROM_TEMPLATE" as const }));

  /* ---- Split the results the UI renders ---- */
  const recognized = classifications
    .filter((c) => c.status === "MATCH" || c.status === "ALIAS")
    .map((c) => c.token);
  // Unknown = a name the system cannot resolve. This is a warning: the user
  // owns the template and the token is simply stripped. Only the structural
  // lists below ever block generation.
  const unknown = classifications
    .filter((c) => c.status === "UNKNOWN_IN_TEMPLATE")
    .map((c) => c.token);

  const blocking = [...invalidConditionals, ...invalidRepeaters, ...invalidSyntax];

  return {
    classifications,
    recognized: [...new Set(recognized)],
    unknown: [...new Set(unknown)],
    unused,
    aliasMappings: aliasMappings.filter(
      (m, i, arr) => arr.findIndex((o) => o.token === m.token) === i,
    ),
    invalidConditionals: [...new Set(invalidConditionals)],
    invalidRepeaters: [...new Set(invalidRepeaters)],
    invalidSyntax: [...new Set(invalidSyntax)],
    canGenerate: blocking.length === 0,
    blocking: [...new Set(blocking)],
  };
}

/** Read a .docx and produce its compatibility report. */
export async function validateTemplateCompatibility(
  bytes: ArrayBuffer,
  config: DocumentConfig,
): Promise<CompatibilityReport> {
  const stream = await extractTemplateTokenStream(bytes);
  return classifyTemplateTokens(stream, config);
}
