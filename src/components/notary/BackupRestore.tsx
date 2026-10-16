/**
 * BACKUP & RESTORE PANEL (§41).
 *
 * The office keeps its own copy. A backup is ONE file the user downloads:
 * `.notary-backup.json`. Restoring is choosing that file again. There is no
 * server, no account, no scheduled upload and nothing that leaves the
 * machine unless the user deliberately saves the file somewhere.
 *
 * §54 — the user controls their own data, so restore always states what will
 * happen BEFORE it happens. "Merge" is the default because a restore must
 * never silently destroy agreements that are not in the file; "Replace" is a
 * separate, explicit choice with its own confirmation.
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  BACKUP_FILE_NAME,
  buildBackup,
  downloadBackup,
  parseBackupText,
  restoreBackup,
  type BackupFile,
} from "@/lib/notary/localBackup";
import { useLocalAgreements } from "@/lib/notary/localHooks";
import { useLang } from "@/lib/lang";
import { AlertTriangle, DatabaseBackup, Download, Upload } from "lucide-react";

export function BackupRestore() {
  const { t } = useLang();
  const { documents } = useLocalAgreements();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [busy, setBusy] = useState(false);

  /** Build the backup and hand the user one file. */
  const onBackup = async () => {
    setBusy(true);
    try {
      const backup = await buildBackup();
      downloadBackup(backup);
      toast.success(
        `${BACKUP_FILE_NAME} ${t("bkMade")} — ${backup.counts.agreements ?? 0} ${t(
          "bkNHyshiis",
        )}, ${backup.counts.drafts ?? 0} ${t("bkNDrafts")}, ${
          backup.counts.templates ?? 0
        } ${t("bkNTemplates")}.`,
      );
    } catch (err) {
      console.error(err);
      toast.error(t("bkToastBackupFail"));
    } finally {
      setBusy(false);
    }
  };

  /** Read the chosen file, then ASK before writing anything. */
  const onPick = async (file: File) => {
    try {
      const text = await file.text();
      const result = parseBackupText(text);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      setPending(result.backup);
    } catch {
      toast.error(t("bkToastFileFail"));
    }
  };

  const applyRestore = async (mode: "merge" | "replace") => {
    if (!pending) return;
    setBusy(true);
    try {
      const written = await restoreBackup(pending, { mode });
      setPending(null);
      const restored = Object.entries(written)
        .filter(([entity]) => entity !== "agreements" && entity !== "drafts")
        .filter(([, count]) => count > 0)
        .map(([entity, count]) => `${count} ${entity}`)
        .join(", ");
      toast.success(
        mode === "replace"
          ? t("bkToastReplaceOk")
          : `${t("bkRestored")}${restored ? `: ${restored}` : ""}.`,
      );
    } catch (err) {
      console.error(err);
      toast.error(t("bkToastRestoreFail"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="notebook-page paper-grain rounded-md p-5"
      data-backup-restore=""
      id="backup"
      aria-label={t("bkAria")}
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <DatabaseBackup className="size-4 text-primary" />
        {t("bkTitle")}
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {t("bkIntro")}
        <strong>{BACKUP_FILE_NAME}</strong>
        {t("bkIntroTail")}
      </p>

      <p className="mt-3 text-xs text-muted-foreground">
        {t("bkLocalCount")}
        <strong>{documents.length}</strong>
        {t("bkDocsLocal")}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onBackup} disabled={busy} className="gap-1.5" data-action="backup">
          <Download className="size-4" /> {t("bkBtnBackup")}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="gap-1.5"
          data-action="restore-pick"
        >
          <Upload className="size-4" /> {t("bkBtnRestore")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-backup-file-input=""
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPick(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Restore always asks first. Two choices, both stated plainly. */}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bkDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {t("bkDialogIntro")}
                  <strong>{new Date(pending?.createdAt ?? 0).toLocaleString("en-GB")}</strong>
                  {t("bkDialogClose")}
                  {" "}
                  {pending?.counts.agreements ?? 0} {t("bkNHyshiis")}, {pending?.counts.drafts ?? 0} {t("bkNDrafts")},
                  {" "}
                  {pending?.counts.templates ?? 0} {t("bkNTemplates")}.
                </p>
                <p>{t("bkMergeDesc")}</p>
                <p className="flex items-start gap-1.5 text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{t("bkReplaceDesc")}</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogAction onClick={() => void applyRestore("merge")} data-action="restore-merge">
              {t("bkBtnMerge")}
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void applyRestore("replace")}
              data-action="restore-replace"
            >
              {t("bkBtnReplace")}
            </AlertDialogAction>
            <AlertDialogCancel>{t("bkCancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default BackupRestore;