/**
 * THE FORM BUILDER — types the office creates of its own.
 *
 * Two screens in one page:
 *   LIST     — the saved custom types, each with Edit / Delete / Tokens.
 *   EDITOR   — the form itself: title, optional reference prefix, optional
 *              sub-types, and the SUBGROUPS with their fields.
 *
 * Saving stores a real DocumentConfig in the local database and registers
 * it into the runtime registry, so the same type immediately shows up in
 * "Dukumenti Cusub", the catalog and the template manager — and the
 * generation pipeline runs it through the very same interview every other
 * type uses. A field saved here yields ONE {{TOKEN}}, the stable name the
 * office types into its own Word template.
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShellWithLang } from "@/components/notary/AppShell";
import { useLang, tf } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown,
  ArrowUp,
  Braces,
  ClipboardPlus,
  Layers,
  PenLine,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { documentConfigs } from "@/lib/notary/documents";
import {
  BUILDER_FIELD_TYPES,
  builderFormFromConfig,
  deleteCustomDocType,
  deserializeCustomConfig,
  emptyBuilderForm,
  saveCustomDocType,
  tokenList,
  useCustomDocumentConfigs,
  validateBuilderForm,
  type BuilderField as BF,
  type BuilderForm,
} from "@/lib/notary/customDocuments";

const labelForType = (t: (key: string) => string, type: string) =>
  t(`bfType_${type}`);

export default function Builder() {
  const navigate = useNavigate();
  const { t } = useLang();
  // Reading this hook is ALSO what registers the office's types into the
  // runtime registry — the interview resolves them from that same list.
  const custom = useCustomDocumentConfigs();

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [form, setForm] = useState<BuilderForm | null>(null);
  const [openTokens, setOpenTokens] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startNew = () => {
    setForm(emptyBuilderForm());
    setEditingRowId(null);
  };
  const startEdit = (rowId: string) => {
    const row = custom.rows.find((r) => r.id === rowId);
    const config = row ? deserializeCustomConfig(row) : undefined;
    if (!config) return;
    setForm(builderFormFromConfig(config));
    setEditingRowId(rowId);
  };
  const back = () => {
    setForm(null);
    setEditingRowId(null);
  };

  /* Mutators over the editor state — plain helpers, one per concern. */
  const patch = (next: Partial<BuilderForm>) =>
    setForm((f) => (f ? { ...f, ...next } : f));

  const patchSection = (si: number, next: Partial<{ title: string }>) =>
    setForm((f) =>
      f
        ? {
            ...f,
            sections: f.sections.map((s, i) =>
              i === si ? { ...s, ...next } : s,
            ),
          }
        : f,
    );

  const addSection = () =>
    setForm((f) =>
      f
        ? {
            ...f,
            sections: [
              ...f.sections,
              {
                title: "",
                fields: [
                  {
                    id: "",
                    label: "",
                    type: "text",
                    required: true,
                    options: [],
                  },
                ],
              },
            ],
          }
        : f,
    );

  const removeSection = (si: number) =>
    setForm((f) =>
      f ? { ...f, sections: f.sections.filter((_, i) => i !== si) } : f,
    );

  const moveSection = (si: number, dir: -1 | 1) =>
    setForm((f) => {
      if (!f) return f;
      const sections = [...f.sections];
      const j = si + dir;
      if (j < 0 || j >= sections.length) return f;
      [sections[si], sections[j]] = [sections[j], sections[si]];
      return { ...f, sections };
    });

  const patchField = (
    si: number,
    fi: number,
    next: Partial<BF>,
  ) =>
    setForm((f) =>
      f
        ? {
            ...f,
            sections: f.sections.map((s, i) =>
              i === si
                ? {
                    ...s,
                    fields: s.fields.map((field, j) =>
                      j === fi ? { ...field, ...next } : field,
                    ),
                  }
                : s,
            ),
          }
        : f,
    );

  const addField = (si: number) =>
    setForm((f) =>
      f
        ? {
            ...f,
            sections: f.sections.map((s, i) =>
              i === si
                ? {
                    ...s,
                    fields: [
                      ...s.fields,
                      {
                        id: "",
                        label: "",
                        type: "text",
                        required: true,
                        options: [],
                      },
                    ],
                  }
                : s,
            ),
          }
        : f,
    );

  const removeField = (si: number, fi: number) =>
    setForm((f) =>
      f
        ? {
            ...f,
            sections: f.sections.map((s, i) =>
              i === si
                ? { ...s, fields: s.fields.filter((_, j) => j !== fi) }
                : s,
            ),
          }
        : f,
    );

  const save = async () => {
    if (!form) return;
    const existingIds = [
      ...documentConfigs.map((c) => c.id),
      ...custom.configs.map((c) => c.id),
    ];
    const errors = validateBuilderForm(form, existingIds, editingRowId ?? undefined);
    if (errors.length > 0) {
      toast.error(errors.join(" "));
      return;
    }
    setSaving(true);
    try {
      await saveCustomDocType(form, editingRowId ?? undefined);
      toast.success(t("bfToastSaved"));
      back();
    } catch (err) {
      console.error("[builder] save failed:", err);
      toast.error(t("bfToastFail"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rowId: string) => {
    const row = custom.rows.find((r) => r.id === rowId);
    if (!row) return;
    // A confirm is fine here: this is a deliberate destructive action and
    // its drafts/archives keep rendering their stored labels as data.
    if (!globalThis.confirm(`"${row.title}" — ${t("bfDeleteConfirm")}`)) return;
    try {
      await deleteCustomDocType(rowId);
      toast.success(t("bfToastDeleted"));
    } catch (err) {
      console.error("[builder] delete failed:", err);
      toast.error(t("bfToastFail"));
    }
  };

  /* ---------------------------------------------------------------- */
  /* LIST — the office's saved types                                   */
  /* ---------------------------------------------------------------- */
  if (!form) {
    return (
      <AppShellWithLang
        title={t("bfTitle")}
        subtitle={t("bfSub")}
        action={
          <Button onClick={startNew} className="gap-2">
            <Plus className="size-4" /> {t("bfNew")}
          </Button>
        }
      >
        {custom.rows.length === 0 && (
          <div className="neu-raised p-8 text-center">
            <Layers className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">{t("bfListEmpty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("bfListEmptyHint")}
            </p>
            <Button className="mt-4 gap-2" onClick={startNew}>
              <ClipboardPlus className="size-4" /> {t("bfListStart")}
            </Button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {custom.rows.map((row) => {
            const config = deserializeCustomConfig(row);
            const sections = config?.sections.filter((s) => s.id !== "heshiiska") ?? [];
            const fieldCount = sections.reduce((n, s) => n + s.fields.length, 0);
            return (
              <div key={row.id} className="neu-raised p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{row.title}</p>
                  <Badge className="hl-blue text-[10px]">{t("bfSavedBadge")}</Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {row.description}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {tf(t, "bfMeta", {
                    sections: String(sections.length),
                    fields: String(fieldCount),
                    subTypes: String(config?.subTypes.length ?? 0),
                  })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => startEdit(row.id)}
                  >
                    <PenLine className="size-3.5" /> {t("bfEditBtn")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      setOpenTokens(openTokens === row.id ? null : row.id)
                    }
                  >
                    <Braces className="size-3.5" /> {t("bfTokensBtn")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => void remove(row.id)}
                  >
                    <Trash2 className="size-3.5" /> {t("bfDeleteBtn")}
                  </Button>
                </div>
                {openTokens === row.id && config && (
                  <div className="neu-inset mt-3 max-h-64 overflow-y-auto p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {t("bfTokenHint")}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {tokenList(config).map((entry) => (
                        <li key={entry.token} className="text-[11px]">
                          <code className="font-semibold">{`{{${entry.token}}}`}</code>
                          <span className="ml-2 text-muted-foreground">{entry.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AppShellWithLang>
    );
  }

  /* ---------------------------------------------------------------- */
  /* EDITOR — one type, its subgroups and their fields                 */
  /* ---------------------------------------------------------------- */
  const slugPreview = form.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  return (
    <AppShellWithLang title={editingRowId ? t("bfEditing") : t("bfNewTitle")}>
      <div className="space-y-6">
        {/* Identity */}
        <div className="neu-raised space-y-3 p-5">
          <div className="space-y-1.5">
            <Label className="text-[13px]">{t("bfFieldTitle")}</Label>
            <Input
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={t("bfTitlePlaceholder")}
              className="bg-card/80"
            />
            {slugPreview && (
              <p className="text-[11px] text-muted-foreground">{t("bfSlugPrefix")} <code>{slugPreview}</code></p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">{t("bfFieldDesc")}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={2}
              placeholder={t("bfDescPlaceholder")}
              className="bg-card/80"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">{t("bfFieldPrefix")}</Label>
            <Input
              value={form.referencePrefix}
              onChange={(e) => patch({ referencePrefix: e.target.value.toUpperCase() })}
              placeholder="DPN-…"
              className="bg-card/80"
            />
            <p className="text-[11px] text-muted-foreground">{t("bfPrefixHint")}</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                className="accent-primary"
                checked={form.acceptSubTypes}
                onChange={(e) => patch({ acceptSubTypes: e.target.checked })}
              />
              {t("bfSubTypesOn")}
            </Label>
            {form.acceptSubTypes && (
              <div className="neu-inset space-y-2 p-3">
                {form.subTypes.map((label, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={label}
                      onChange={(e) =>
                        patch({
                          subTypes: form.subTypes.map((s, j) =>
                            j === i ? e.target.value : s,
                          ),
                        })
                      }
                      placeholder={t("bfSubTypePlaceholder")}
                      className="bg-card/80"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        patch({ subTypes: form.subTypes.filter((_, j) => j !== i) })
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => patch({ subTypes: [...form.subTypes, ""] })}
                >
                  <Plus className="size-3.5" /> {t("bfAddSubType")}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Sections (subgroups) */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold">{t("bfSections")}</h2>
          {form.sections.map((section, si) => (
            <div key={si} className="neu-raised space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Label className="shrink-0 text-[12px]">{t("bfSectionTitle")}</Label>
                <Input
                  value={section.title}
                  onChange={(e) => patchSection(si, { title: e.target.value })}
                  placeholder={tf(t, "bfSectionPlaceholder", { n: si + 1 })}
                  className="bg-card/80"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={si === 0}
                  onClick={() => moveSection(si, -1)}
                  aria-label={t("bfMoveUp")}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={si === form.sections.length - 1}
                  onClick={() => moveSection(si, 1)}
                  aria-label={t("bfMoveDown")}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeSection(si)}
                  aria-label={t("bfRemoveSection")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {section.fields.map((field, fi) => (
                  <div key={fi} className="neu-inset flex flex-wrap items-end gap-2 p-3">
                    <div className="min-w-44 flex-1 space-y-1">
                      <Label className="text-[11px]">{t("bfFieldLabel")}</Label>
                      <Input
                        value={field.label}
                        onChange={(e) => patchField(si, fi, { label: e.target.value })}
                        placeholder={t("bfFieldLabelPlaceholder")}
                        className="bg-card/80"
                      />
                      {field.label.trim() && (
                        <p className="text-[10px] text-muted-foreground">
                          {t("bfTokenPrefix")} <code>{`{{${field.id || field.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase()}}}`}</code>
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">{t("bfFieldType")}</Label>
                      <select
                        value={field.type}
                        onChange={(e) =>
                          patchField(si, fi, {
                            type: e.target.value,
                            // Types that take no options drop any leftovers.
                            options: e.target.value === "select" ? field.options : [],
                          } as Partial<BF>)
                        }
                        className="h-9 rounded-md border border-input bg-card/80 px-3 text-sm"
                      >
                        {BUILDER_FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {labelForType(t, type)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {field.type === "select" && (
                      <div className="min-w-64 flex-1 space-y-1">
                        <Label className="text-[11px]">{t("bfFieldOptions")}</Label>
                        <Input
                          value={field.options.join(", ")}
                          onChange={(e) =>
                            patchField(si, fi, {
                              options: e.target.value.split(","),
                            })
                          }
                          placeholder={t("bfOptionsPlaceholder")}
                          className="bg-card/80"
                        />
                      </div>
                    )}
                    <Label className="flex items-center gap-1.5 pb-2 text-[11px]">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={field.required}
                        onChange={(e) => patchField(si, fi, { required: e.target.checked })}
                      />
                      {t("bfFieldRequired")}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeField(si, fi)}
                      aria-label={t("bfRemoveField")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => addField(si)}
                >
                  <Plus className="size-3.5" /> {t("bfAddField")}
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" className="gap-2" onClick={addSection}>
            <Layers className="size-4" /> {t("bfAddSection")}
          </Button>
        </div>

        {/* Bottom bar */}
        <div className="neu-raised-sm sticky bottom-4 flex items-center justify-between gap-2 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/documents")}
            className="gap-2"
          >
            <X className="size-4" /> {t("bfGoDocuments")}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={back}>
              {t("bfCancel")}
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving} className="glow-primary-sm gap-2">
              {saving ? (
                <>{t("bfSaving")}</>
              ) : (
                <>
                  <Save className="size-4" /> {t("bfSave")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppShellWithLang>
  );
}
