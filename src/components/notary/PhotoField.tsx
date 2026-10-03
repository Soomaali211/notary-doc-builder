import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Photo picker for a person — the value stored in the form is the Convex
 * STORAGE ID, never the image bytes. Keeping the draft small is what lets
 * the notary paste ten photos into one agreement without the saved record
 * blowing past the server's size limit.
 *
 * It lives in its own component on purpose: the upload needs Convex's
 * `useMutation`, and FieldRenderer is rendered in isolation (server-side
 * tests, the review screen). Only a field explicitly typed "photo" ever
 * mounts this — every existing field of every other document type takes the
 * untouched input branch, so nothing else depends on a Convex provider.
 *
 * The image itself is fetched and placed into the .docx by the generation
 * step (Phase 2); here we only collect and store it.
 */
export function PhotoField({
  value,
  disabled,
  error,
  onChange,
}: {
  /** Convex storage id of the uploaded photo, or "" when none. */
  value: string;
  disabled?: boolean;
  error?: string;
  onChange: (storageId: string) => void;
}) {
  const getUploadUrl = useMutation(api.notaryDocuments.generateUploadUrl);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const upload = async (file: File) => {
    setBusy(true);
    setUploadError("");
    try {
      const url = await getUploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Sawirka lama soo roobin.");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      onChange(storageId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Sawirka lama soo roobin.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Dooro sawirka"
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {value ? (
        <div className="neu-inset-sm flex items-center justify-between gap-3 px-3 py-2">
          <span className="truncate text-sm text-muted-foreground">
            Sawir waa la soo roobay
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
              Waa la soo roobaa…
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
