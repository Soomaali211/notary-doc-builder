/**
 * DOCUMENT STATUS (§44).
 *
 * The office named exactly four statuses and this file is their ONLY place:
 *
 *   Draft      — an interview in progress
 *   Completed  — the interview is finished, the file is not exported yet
 *   Exported   — a DOCX was produced and stored (the stored value is
 *                "generated" — the office word for it is "Exported")
 *   Archived   — finished and put away
 *
 * No fifth status is introduced here. A status the office did not name is a
 * change of meaning, not a new label, so one was not added.
 *
 * The mapping is one-directional and total: an unknown stored value renders
 * as itself rather than as an empty badge or a lie.
 */

export const DOCUMENT_STATUSES = [
  "draft",
  "completed",
  "generated",
  "archived",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Stored value → the office's word for it. */
const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Draft",
  completed: "Completed",
  generated: "Exported",
  archived: "Archived",
};

/** The office's word for a stored status. Unknown values pass through. */
export function documentStatusLabel(status: string): string {
  return STATUS_LABELS[status as DocumentStatus] ?? status;
}

/**
 * A status is "finished" once the document left the interview. Used to split
 * Home into Drafts and generated documents without repeating the literals.
 */
export function isFinishedStatus(status: string): boolean {
  return status === "generated" || status === "archived";
}