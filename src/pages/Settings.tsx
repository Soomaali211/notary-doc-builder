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
import { AppShellWithLang } from "@/components/notary/AppShell";
import { useLang } from "@/lib/lang";
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
import { Building2, Check, Eye, Save, WifiOff } from "lucide-react";
import { BackupRestore } from "@/components/notary/BackupRestore";
import {
  readOfflineSettings,
  writeOfflineSettings,
  type OfflineSettings,
} from "@/lib/notary/offlineMode";
import {
  EMPTY_SETTINGS,
  headerLines,
  readSettings,
  writeSettings,
  type OfficeSettings,
} from "@/lib/notary/settings";

export {
  EMPTY_SETTINGS,
  headerLines,
  readSettings,
  writeSettings,
  type OfficeSettings,
};

export default function Settings() {
  const { t } = useLang();
  const [settings, setSettings] = useState<OfficeSettings>(EMPTY_SETTINGS);
  const [offline, setOffline] = useState<OfflineSettings>(readOfflineSettings());
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
    <AppShellWithLang title={t("tabSettings")} subtitle={t("setSub")}>
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

      {/* §3 — the offline promise, stated where the office can see it. */}
      <div className="mt-6 grid gap-6">
        <section
          className="notebook-page paper-grain rounded-md p-5"
          data-offline-mode=""
        >
          <h2 className="flex items-center gap-2 font-semibold">
            <WifiOff className="size-4 text-primary" />
            Offline Mode
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {offline.offline ? (
              <>
                <strong className="text-foreground">Waa la shaqeeyaa.</strong> Database-ku,
                template-yada, search-ka, drafts-ka iyo files-ka waa computer-gaan oo keliya.
                Internet markii la damiyo, nidaamku wuxuu weli ka shaqeeyaa: Create → Edit →
                Review → Save → DOCX → PDF → Print → Search.
              </>
            ) : (
              <>
                <strong className="text-foreground">Waa la damay.</strong> Nidaamku wuxuu
                hadda isticmaali karaa khadka. Tan iyo dad-ka xogta sidaas ayuu ula wareegayaa
                (wixii <span className="underline">offline</span>).
              </>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant={offline.offline ? "outline" : "default"}
              onClick={() => {
                const next = { ...offline, offline: !offline.offline };
                setOffline(next);
                writeOfflineSettings(next);
                toast.success(
                  next.offline
                    ? "Offline mode ayaa la furay — nidaamku hadda wuxuu local buuq yahay."
                    : "Cloud mode ayaa la furay.",
                );
              }}
              data-action="toggle-offline"
            >
              {offline.offline ? "Dami" : "Fur"}
            </Button>
          </div>
        </section>

        <BackupRestore />
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
    </AppShellWithLang>
  );
}