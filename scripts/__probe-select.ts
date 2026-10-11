import { kalaIiibsiHantiConfig as C } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { selectTemplate } from "../src/lib/notary/registry";
import { createInitialValues } from "../src/lib/notary/formValues";
import type { FormValues } from "../src/lib/notary/types";

for (const sub of ["dhul_banaan", "guri", "beer"]) {
  const values = createInitialValues(C) as FormValues;
  (values as any)[C.setupSectionId ?? "dejinta"] = { sub_type: sub };
  const spec = selectTemplate(C, values);
  console.log(sub, "→", spec?.templateId, spec?.filePath);
}
