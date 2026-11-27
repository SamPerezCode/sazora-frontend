import { useEffect, useId, useRef, useState } from "react";
import { PackageOpen, Upload } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { resolveFileUrl } from "../../../lib/files";
import { validateProductImage } from "../services/product.service";

interface ProductImageFieldProps {
  file: File | null;
  name: string;
  disabled: boolean;
  currentImageUrl?: string | null;
  onChange: (file: File | null) => void;
}

export function ProductImageField({
  file,
  name,
  disabled,
  currentImageUrl,
  onChange,
}: ProductImageFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);
  const [selection, setSelection] = useState<{
    file: File;
    url: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [failedSource, setFailedSource] = useState<string | null>(
    null
  );

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    []
  );

  function clearSelection() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setSelection(null);
    onChange(null);
    if (input.current) input.current.value = "";
  }

  const src =
    file && selection?.file === file
      ? selection.url
      : resolveFileUrl(currentImageUrl ?? null);

  return (
    <div className="product-image-field">
      <label htmlFor={id}>Imagen del producto (opcional)</label>

      <div className="product-image-frame">
        {src && src !== failedSource ? (
          <img
            src={src}
            alt={
              "Vista previa de " +
              (name.trim() || "la imagen del producto")
            }
            onError={() => {
              setFailedSource(src);
              if (file) {
                clearSelection();
                setError(
                  "No pudimos visualizar la imagen. Selecciona otro archivo."
                );
              }
            }}
          />
        ) : (
          <PackageOpen size={40} aria-hidden="true" />
        )}
      </div>

      <div className="product-image-upload">
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            id + "-help" + (error ? " " + id + "-error" : "")
          }
          onChange={(event) => {
            const next = event.currentTarget.files?.[0];
            if (!next) return;
            const message = validateProductImage(next);
            clearSelection();
            setError(message ?? "");
            if (message) return;

            const url = URL.createObjectURL(next);
            objectUrl.current = url;
            setSelection({ file: next, url });
            setFailedSource(null);
            onChange(next);
          }}
        />

        <div className="product-image-upload-content">
          <Upload size={20} aria-hidden="true" />
          <div>
            <strong>
              {file ? "Cambiar archivo" : "Seleccionar archivo"}
            </strong>
            <p role="status">
              {file?.name ?? "Ningún archivo seleccionado"}
            </p>
          </div>
        </div>
      </div>

      <div id={id + "-help"} className="space-y-2 text-xs text-muted">
        <p>
          <strong className="text-heading">
            Formatos admitidos:
          </strong>{" "}
          JPEG, PNG o WebP. Tamaño máximo: 5 MB.
        </p>

        <p>
          <strong className="text-heading">Recomendación:</strong>{" "}
          imagen cuadrada de 1200 × 1200 píxeles, preferiblemente
          WebP, con un peso de 100 a 300 KB.
        </p>

        <p>
          Centra el producto, utiliza un fondo sencillo y deja
          aproximadamente un 20 % de espacio arriba y abajo. Evita
          incluir textos o precios dentro de la imagen.
        </p>

        <p>
          El menú muestra una miniatura cuadrada y un detalle
          horizontal. Los bordes pueden recortarse; mantén el producto
          dentro de la zona central.
        </p>

        <p>Las dimensiones y el peso recomendado son orientativos.</p>
      </div>

      {error && (
        <p
          id={id + "-error"}
          role="alert"
          className="text-sm text-danger"
        >
          {error}
        </p>
      )}

      {file && (
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            clearSelection();
            setError("");
          }}
        >
          Quitar selección
        </Button>
      )}
    </div>
  );
}
