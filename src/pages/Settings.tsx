/**
 * SETTINGS (§62 / §63).
 *
 * Settings holds what is NOT a business rule: the office's own details, how
 * exports are named, and what the review pane defaults to. Legal wording,
 * party rules and template rules never live here — those belong to the
 * document config and to the office's own Word file (§62).
 *
 * §63 says office information must never be invented. So every field starts
 * EMPTY. Nothing here is pre-filled with a guessed office name, address or
 * phone number, and no legal header text is generated: what the notary types
 * is what the header reads, character for character.
 *
 * The office details are stored in this browser only (localStorage). They
 * are shown back to the notary exactly as typed so they can be checked
 * against the office's real letterhead before any template uses them.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/notary/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Check, Eye, Save } from "lucide-react";

/** Bumped only when the stored shape changes. */
const STORAGE_KEY = "notary.settings.v1";

export interface OfficeSettings {
  /** Office name — as the office writes it, never auto-generated. */
  officeName: string;
  address: string;
  phone: string;
  /** Extra line printed under the phone (e.g. email). */
  extra: string;
  /** Date format used on exported file names. */
  dateFormat: "iso" | "dmy";
}

/** Every field starts blank: an unverified office detail must stay unset. */
export const EMPTY_SETTINGS: OfficeSettings = {
  officeName: "",
  address: "",
  phone: "",
  extra: "",
  dateFormat: "iso",
};

/** Read the stored settings, tolerating absent/partial/corrupt storage. */
export function readSettings(): OfficeSettings {
  if (typeof localStorage === "undefined") return { ...EMPTY_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<OfficeSettings> | null;
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_SETTINGS };
    return {
      officeName: String(parsed.officeName ?? ""),
      address: String(parsed.address ?? ""),
      phone: String(parsed.phone ?? ""),
      extra: String(parsed.extra ?? ""),
      dateFormat: parsed.dateFormat === "dmy" ? "dmy" : "iso",
    };
  } catch {
    return { ...EMPTY_SETTINGS };
  }
}

export function writeSettings(value: OfficeSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the settings simply do not persist. Never
    // throw into the notary's face over a preference.
  }
}

/**
 * The header lines these settings produce — in the order they print, with
 * blank lines dropped so an unfilled field leaves no empty line behind.
 * This is typography only: it invents no wording and adds no label.
 */
export function headerLines(s: OfficeSettings): string[] {
  return [s.officeName, s.address, s.phone, s.extra]
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export default function Settings() {
  const [settings, setSettings] = useState<OfficeSettings>(EMPTY_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setLoaded(true);
  }, []);

  const lines = useMemo(() => headerLines(settings), [settings]);
  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(readSettings()),
    [settings],
  );

  const save = () => {
    writeSettings(settings);
    toast.success("Settings la kaydiyay.");
  };

  const update = <K extends keyof OfficeSettings>(key: K, value: OfficeSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  return (
    <AppShell title="Settings" subtitle="Xogta xafiiska iyo doorashooyinka export-ka.">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Office information — §63 */}
        <section className="notebook-page paper-grain rounded-md p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Building2 className="size-4 text-primary" />
            Xogta Xafiiska
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Halkan halkan ayaa laga qaadanaysaa. Waxaa la baraf danbeed qarsoon — qofna
            magac kale ma bixin karo.
          </p>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="office-name">Magaca Xafiiska</Label>
              <Input
                id="office-name"
                value={settings.officeName}
                onChange={(e) => update("officeName", e.target.value)}
                placeholder="Sida uu xafiisku u qor"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="office-address">Cinwaan</Label>
              <Input
                id="office-address"
                value={settings.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="office-phone">Telefoon</Label>
              <Input
                id="office-phone"
                value={settings.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="office-extra">Xaraf kale (iimayl, iyo kuwa kale)</Label>
              <Input
                id="office-extra"
                value={settings.extra}
                onChange={(e) => update("extra", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Export + appearance defaults — §62 */}
        <section className="notebook-page paper-grain rounded-md p-5">
          <h2 className="font-semibold">Export &amp; Eegis</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Magaca faylka wuxuu hadda ahaa
            <span className="font-medium"> Reference_DocumentType</span>. Qaabka taariikhda ayaa
            halkan laga badbaadinayaa.
          </p>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="date-format">Qaabka taariikhda</Label>
            <Select
              value={settings.dateFormat}
              onValueChange={(v) => update("dateFormat", v as OfficeSettings["dateFormat"])}
            >
              <SelectTrigger id="date-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="iso">2026-10-04 (ISO)</SelectItem>
                <SelectItem value="dmy">04-10-2026 (DMY)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Live look at the header, so the notary can compare it with the
              office's real letterhead. Nothing is generated here. */}
          <div className="mt-5 rounded-md border border-dashed border-border p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Eye className="size-3" /> Sidda u egaysan
            </p>
            <div className="mt-2 rounded-sm bg-white px-3 py-2 text-center text-[13px] leading-5 text-[#111111]">
              {lines.length === 0 ? (
                <p className="text-[11px] text-[#888888]">
                  Siddu waa hadhi weli. Sii magac kor si uu u muuqdo.
                </p>
              ) : (
                lines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={!loaded} className="gap-1.5">
          {isDirty ? <Save className="size-4" /> : <Check className="size-4" />}
          Kaydi
        </Button>
        {isDirty && (
          <Button variant="ghost" onClick={() => setSettings(readSettings())}>
            Soo celi
          </Button>
        )}
        <Link to="/templates" className="text-xs font-medium text-primary hover:underline">
          Maaree Template-yada →
        </Link>
      </div>
    </AppShell>
  );
}