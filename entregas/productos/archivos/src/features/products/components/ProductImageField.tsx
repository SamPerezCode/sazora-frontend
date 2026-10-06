import { useEffect, useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Avatar } from "../../../components/ui/Avatar";
import { validateProductImage } from "../services/product.service";

export function ProductImageField({ file, onChange, disabled, name }: {
  file: File | null; onChange: (file: File | null) => void; disabled: boolean; name: string;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const objectUrl = useRef<string | null>(null);
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);
  return <div className="space-y-2">
    {file && <Avatar name={name} src={preview} size="xl" />}
    <label htmlFor={id} className="block text-sm font-medium text-heading">Imagen opcional</label>
    <div className="relative rounded-xl border border-input-border bg-secondary/30 p-4 focus-within:ring-2 focus-within:ring-accent">
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled}
        aria-describedby={id + "-help"} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={e => {
          const next = e.currentTarget.files?.[0];
          if (!next) return;
          const message = validateProductImage(next);
          if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
          objectUrl.current = message ? null : URL.createObjectURL(next);
          setPreview(objectUrl.current);
          setError(message ?? "");
          onChange(message ? null : next);
          if (message) e.currentTarget.value = "";
        }} />
      <div className="flex items-center gap-3 text-sm text-heading">
        <Upload size={20} className="shrink-0 text-accent" />
        <span className="min-w-0 break-words">{file?.name ?? "Seleccionar archivo"}</span>
      </div>
    </div>
    <p id={id + "-help"} className="text-xs text-muted">JPEG, PNG o WebP. Máximo 5 MB.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>;
}
