import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppShellWithLang } from "@/components/notary/AppShell";
import { useLang } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, CheckCircle2, Trash2, XCircle } from "lucide-react";

/** Book a signing appointment for a document or a team meeting. */
export default function Schedule() {
  const { t } = useLang();
  const appointments = useQuery(api.notaryAppointments.listMine);
  const documents = useQuery(api.notaryDocuments.listMyDocuments);
  const create = useMutation(api.notaryAppointments.create);
  const setStatus = useMutation(api.notaryAppointments.setStatus);
  const remove = useMutation(api.notaryAppointments.remove);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim() || !date || !time) {
      toast.error(t("scMissing"));
      return;
    }
    setSubmitting(true);
    try {
      await create({
        title,
        date,
        time,
        location: location || undefined,
        notes: notes || undefined,
        documentId: documentId ? (documentId as never) : undefined,
      });
      toast.success(t("scToastOk"));
      setTitle("");
      setDate("");
      setTime("");
      setLocation("");
      setDocumentId("");
      setNotes("");
    } catch {
      toast.error(t("scToastFail"));
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "completed") return <Badge className="hl-green text-[10px]">{t("scDone")}</Badge>;
    if (status === "cancelled") return <Badge variant="secondary" className="text-[10px]">{t("scCancelled")}</Badge>;
    return <Badge className="hl-blue text-[10px]">{t("scScheduled")}</Badge>;
  };

  return (
    <AppShellWithLang title={t("scTitle")} subtitle={t("scSub")}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Upcoming list */}
        <section className="notebook-page paper-grain rounded-md p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4 text-primary" /> {t("scYourAppts")}
          </h2>
          {!appointments && (
            <p className="text-sm text-muted-foreground">{t("scLoading")}</p>
          )}
          {appointments && appointments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("scEmpty")}
            </p>
          )}
          <ul className="divide-y divide-dashed divide-border/70">
            {(appointments ?? []).map((a) => (
              <li key={a._id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.title}</span>
                      {statusBadge(a.status)}
                    </div>
                    <p className="notebook-annotation mt-0.5 text-xs text-muted-foreground">
                      {a.date} · {a.time}
                      {a.location ? ` · ${a.location}` : ""}
                    </p>
                    {a.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{a.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {a.status === "scheduled" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => setStatus({ id: a._id, status: "completed" })}
                        >
                          <CheckCircle2 className="size-3.5 text-pen-green" /> {t("scDone")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => setStatus({ id: a._id, status: "cancelled" })}
                        >
                          <XCircle className="size-3.5" /> {t("scCancel")}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => remove({ id: a._id })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Booking form */}
        <section className="notebook-page paper-grain rounded-md p-5">
          <h2 className="mb-3 text-sm font-semibold">{t("scBook")}</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">{t("scFieldTitle")}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("scTitlePlaceholder")}
                className="bg-card/80"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px]">{t("scFieldDate")}</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-card/80"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">{t("scFieldTime")}</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-card/80"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">{t("scFieldLocation")}</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("scLocationPlaceholder")}
                className="bg-card/80"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">{t("scFieldDocument")}</Label>
              <select
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card/80 px-3 text-sm"
              >
                <option value="">{t("scNoDoc")}</option>
                {(documents ?? []).map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.referenceNumber || t("scDraftOption")} · {d.subTypeLabel}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">{t("scFieldNotes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={t("scNotesPlaceholder")}
                className="bg-card/80"
              />
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? t("scBooking") : t("scBookBtn")}
            </Button>
          </div>
        </section>
      </div>
    </AppShellWithLang>
  );
}
