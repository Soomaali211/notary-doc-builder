import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";

/**
 * Photo picker for a person — §36: a photograph is its OWN entity, attached
 * to a person, never to a "seller slot" and never counted against anyone.
 *
 * §3/§54 — the image never leaves this machine. The value stored in the form
 * is a `data:` URL, so the photograph is kept inside the draft, travels in
 * the backup, and is embedded in the generated DOCX and PDF without a single
 * byte being uploaded anywhere. The old path fetched an upload URL from a
 * server and POSTed the file to it; that path is gone.
 *
 * It stays in its own component because FieldRenderer is rendered in
 * isolation (server-side tests, the review screen): only a field explicitly
 * typed "photo" ever mounts this, so nothing else gains a dependency on it.
 */

/** How large a stored photograph may be, in bytes. */
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

async function readAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Sawirka lama akhrin karo."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

export function PhotoField({
  value,
  disabled,
  error,
  onChange,
}: {
  /** The stored `data:` URL of the photograph, or "" when there is none. */
  value: string;
  disabled?: boolean;
  error?: string;
  onChange: (dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");

  /**
   * §43 — a failure the notary can act on. A photo over the size limit says
   * so in plain words; it never shows a technical error and never fails
   * silently.
   */
  const pick = async (file: File) => {
    setUploadError("");
    if (!file.type.startsWith("image/")) {
      setUploadError("Faylka ma aha sawir. Dooro sawir.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setUploadError(
        "Sawirku waa weyn (4 MB ka badan). Dooro sawir yar oo la qaadi karo.",
      );
      return;
    }
    setBusy(true);
    try {
      onChange(await readAsDataUrl(file));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Sawirka lama akhrin karo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2" data-photo-field="">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Dooro sawirka"
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pick(file);
        }}
      />

      {value ? (
        <div className="neu-inset-sm flex items-center justify-between gap-3 px-3 py-2">
          {/* The notary sees the picture they chose, not just a status line. */}
          <span className="flex min-w-0 items-center gap-2">
            <img
              src={value}
              alt="Sawirka la beddelay"
              className="size-9 shrink-0 rounded object-cover"
            />
            <span className="truncate text-sm text-muted-foreground">
              Sawir waa la beddelay
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              <Camera className="size-3.5" />
              Bedel
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-destructive"
              disabled={disabled || busy}
              onClick={() => onChange("")}
            >
              <Trash2 className="size-3.5" />
              Ka saar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Waa la akhrinayaa…
            </>
          ) : (
            <>
              <Camera className="size-4" />
              Dooro sawirka
            </>
          )}
        </Button>
      )}

      {(uploadError || error) && (
        <p className="text-sm text-destructive">
          ✗ {uploadError || error}
        </p>
      )}
    </div>
  );
}