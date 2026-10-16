/**
 * MACAAMIISHA — the client list, derived from the documents that exist.
 *
 * There is no global client table anywhere in the model (§12: a role is
 * per-agreement), so the client list is built from the party rows inside
 * each agreement's stored values. Every name comes from data the office
 * already typed; nothing is invented and nothing is editable here yet.
 *
 * One human being who appears in two agreements is ONE client: rows are
 * matched on name + phone, exactly as stored — same name with a different
 * phone stays two entries, because the office never said it is one person.
 *
 * §33: a family / group (`kooxaha`) is a NAME, never a person, so group
 * rows are counted and listed separately and cannot contaminate the
 * people count.
 */
import { isPartyList } from "./conditions";
import { getConfig } from "./documents";
import type { LocalAgreement } from "./localModel";
import type { PartyRow } from "./types";

/** One appearance of a client inside one agreement. */
export interface ClientAppearance {
  agreementId: string;
  referenceNumber: string;
  documentTypeTitle: string;
  subTypeLabel: string;
  status: string;
  /** The role word the document's own config gives this party list. */
  roleLabel: string;
}

export interface ClientEntry {
  /** Dedupe key: normalized name + phone. */
  key: string;
  name: string;
  phone: string;
  isGroup: boolean;
  appearances: ClientAppearance[];
}

/**
 * The party lists that hold a FAMILY / GROUP name (§33). Every other party
 * list holds real people.
 */
const GROUP_PARTIES = new Set(["kooxaha"]);

function parseValues(agreement: LocalAgreement): Record<string, unknown> {
  try {
    return JSON.parse(agreement.valuesJson ?? "{}") as Record<string, unknown>;
  } catch {
    // A draft whose blob is unreadable cannot name a client; it must not
    // take the whole page down.
    return {};
  }
}

/** partyId → the label the document's own config prints (e.g. "Iibiye"). */
function partyLabelMap(agreement: LocalAgreement): Map<string, string> {
  const map = new Map<string, string>();
  const cfg = getConfig(agreement.documentType);
  if (!cfg) return map;
  for (const section of cfg.sections) {
    for (const party of section.parties ?? []) {
      map.set(party.id, party.singular || party.label || party.id);
    }
  }
  return map;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s()-]/g, "");
}

function clientKey(name: string, phone: string): string {
  return `${name.trim().toLowerCase()}|${normalizePhone(phone)}`;
}

function appearancesFor(
  agreement: LocalAgreement,
  partyId: string,
  labels: Map<string, string>,
): ClientAppearance {
  return {
    agreementId: agreement.id,
    referenceNumber: agreement.referenceNumber,
    documentTypeTitle: agreement.documentTypeTitle,
    subTypeLabel: agreement.subTypeLabel,
    status: agreement.status,
    roleLabel: labels.get(partyId) ?? partyId,
  };
}

/** Every client entry the archive's agreements name, sorted by name. */
export function clientsFromAgreements(agreements: LocalAgreement[]): ClientEntry[] {
  const byKey = new Map<string, ClientEntry>();
  for (const agreement of agreements) {
    const values = parseValues(agreement);
    const labels = partyLabelMap(agreement);
    for (const [partyId, sectionValue] of Object.entries(values)) {
      if (!isPartyList(sectionValue)) continue;
      const isGroup = GROUP_PARTIES.has(partyId);
      for (const row of sectionValue as PartyRow[]) {
        const name = (row.values?.magac ?? "").trim();
        if (!name) continue;
        const phone = (row.values?.telefoon ?? "").trim();
        const key = clientKey(name, phone);
        const entry = byKey.get(key) ?? {
          key,
          name,
          phone,
          isGroup,
          appearances: [],
        };
        entry.appearances.push(appearancesFor(agreement, partyId, labels));
        byKey.set(key, entry);
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "so"));
}

/** The people only (§33: a group never counts as a person). */
export function peopleCount(entries: ClientEntry[]): number {
  return entries.filter((e) => !e.isGroup).length;
}

/** The groups only. */
export function groupCount(entries: ClientEntry[]): number {
  return entries.filter((e) => e.isGroup).length;
}
