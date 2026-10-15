/**
 * SOON — a tab whose page rebuild comes in the next steps.
 * One title, one line, no fake content, no fake data.
 */
import { AppShellWithLang } from "@/components/notary/AppShell";
import { useLang } from "@/lib/lang";

export default function Soon({ titleKey }: { titleKey: string }) {
  const { t } = useLang();
  return (
    <AppShellWithLang title={t(titleKey)}>
      <p className="text-sm text-muted-foreground">{t("notYetRebuilt")}</p>
    </AppShellWithLang>
  );
}
