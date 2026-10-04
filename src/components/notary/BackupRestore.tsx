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
import { AlertTriangle, DatabaseBackup, Download, Upload } from "lucide-react";

export function BackupRestore() {
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
        `${BACKUP_FILE_NAME} waa la soo saaray — ${backup.counts.agreements ?? 0} heshiis, ${
          backup.counts.drafts ?? 0
        } draft, ${backup.counts.templates ?? 0} template.`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Backup-ku lama sameeyn karin — isku day mar kale.");
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
      toast.error("Faylka lama akhrin karo.");
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
          ? "Xogtu waa la beddelay — hadda waxay ku qaraysaa sida backup-ka."
          : `Waxaa la soo geliyay${restored ? `: ${restored}` : ""}.`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Restore-ku lama fulin karin — xogtaada hadda waa weli la hay.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="notebook-page paper-grain rounded-md p-5"
      data-backup-restore=""
      id="backup"
      aria-label="Backup iyo Restore"
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <DatabaseBackup className="size-4 text-primary" />
        Backup &amp; Restore
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Nidaamku waa <strong>offline</strong> — database-ku, template-yadu iyo
        dukumeentiguba waa computer-gaan oo keliya. Halkan ayaad nuqul ka soo saari kartaa:
        hal fayl oo la yiraahdo <strong>{BACKUP_FILE_NAME}</strong>, oo ku jira dhammaan
        heshiisyada, drafts, tixraacyada, settings-ka iyo template-yada la beddelay.
        Faylka ma aha erayo gaar ah — waxaad adiguna ma qaban karto.
      </p>

      <p className="mt-3 text-xs text-muted-foreground">
        Haddii computer-ka lumi loo: <strong>{documents.length}</strong> document ayaa hadda
        maxalliga ah.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onBackup} disabled={busy} className="gap-1.5" data-action="backup">
          <Download className="size-4" /> Backup Database
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="gap-1.5"
          data-action="restore-pick"
        >
          <Upload className="size-4" /> Restore Backup
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
            <AlertDialogTitle>Restore backup</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Faylkan waxaa lagu daray{" "}
                  <strong>{new Date(pending?.createdAt ?? 0).toLocaleString("en-GB")}</strong>:
                  {" "}
                  {pending?.counts.agreements ?? 0} heshiis, {pending?.counts.drafts ?? 0} draft,
                  {" "}
                  {pending?.counts.templates ?? 0} template.
                </p>
                <p>
                  <strong>Merge</strong> — waxa jira ayaa la ilaaliyaa; waxa faylku wataa ayaa
                  la daro/ la beddelaa. Tani waa doorashada badbaadada leh.
                </p>
                <p className="flex items-start gap-1.5 text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    <strong>Replace</strong> — database-ka waxaa la maro maran. Waxa hadda
                    ku jira oo <em>backup-ka aan ku jirin</em> ayaa si buuxda u baaba&apos;dood
                    doonaa. Tani waa eex.
                  </span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogAction onClick={() => void applyRestore("merge")} data-action="restore-merge">
              Merge
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void applyRestore("replace")}
              data-action="restore-replace"
            >
              Waxa jira oo maro maran
            </AlertDialogAction>
            <AlertDialogCancel>Jooji</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default BackupRestore;