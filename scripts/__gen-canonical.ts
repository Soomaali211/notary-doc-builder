import { buildHantiCanonicalBytes } from "../src/lib/notary/templateBuilderHanti";
import { writeFileSync, mkdirSync } from "node:fs";
const outDir = "/home/daytona/codebase/public/templates/kala_iiibsi_hanti";
mkdirSync(outDir, { recursive: true });
const bytes = await buildHantiCanonicalBytes();
writeFileSync(`${outDir}/canonical.docx`, bytes);
console.log("bytes:", bytes.length);
