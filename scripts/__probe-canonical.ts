import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { getConfig } from "../src/lib/notary/documents";
import { scanTemplateTokens } from "../src/lib/notary/userTemplate";

const CONFIG = getConfig("kala_iibsi_hanti")!;
const bytes = readFileSync("public/templates/kala_iiibsi_hanti/canonical.docx");
const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
const report = await scanTemplateTokens(ab, CONFIG);
console.log("tokens:", report.tokens.length, "| unknown:", JSON.stringify(report.unknown), "| syntaxErrors:", report.syntaxErrors.length);
