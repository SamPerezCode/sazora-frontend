import { Avatar } from "../../../components/ui/Avatar";
import { resolveFileUrl } from "../../../lib/files";
import type {
  BusinessDraft,
  BusinessSettings,
} from "../business-settings.schema";

interface BrandPreviewProps {
  draft: BusinessDraft;
  settings: BusinessSettings;
  localLogo: string | null;
}

export function BrandPreview({
  draft,
  settings,
  localLogo,
}: BrandPreviewProps) {
  const validColor = (value: string, fallback: string) =>
    /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

  const primary = validColor(
    draft.primaryColor,
    settings.primaryColor
  );

  const accent = validColor(draft.accentColor, settings.accentColor);

  return (
    <section
      className="business-preview"
      aria-label="Vista previa de tu marca"
    >
      <h2 className="business-preview-heading">
        Vista previa de tu marca
      </h2>

      <div
        className="business-brand-preview"
        style={{
          backgroundImage: `linear-gradient(rgb(0 0 0 / 35%), rgb(0 0 0 / 35%)), linear-gradient(120deg, ${primary}, ${accent})`,
        }}
      >
        <Avatar
          name={draft.name}
          src={localLogo ?? resolveFileUrl(settings.logoUrl)}
          size="lg"
        />

        {draft.tagline && (
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em]">
            {draft.tagline}
          </p>
        )}

        <h3 className="mt-2 break-words text-2xl font-bold">
          {draft.name || "Nombre del negocio"}
        </h3>

        {draft.publicMenuDescription && (
          <p className="mt-4 text-sm leading-relaxed">
            {draft.publicMenuDescription}
          </p>
        )}

        <p className="mt-4 text-xs leading-relaxed">
          {[draft.address, draft.openingHoursText]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </section>
  );
}

export function TicketPreview({ draft }: { draft: BusinessDraft }) {
  return (
    <section
      className="business-preview"
      aria-label="Vista previa de la comanda"
    >
      <h2 className="business-preview-heading">
        Así se ve tu comanda
      </h2>

      <div className="business-ticket-preview">
        <p className="break-words font-bold uppercase tracking-widest">
          {draft.name || "Nombre del negocio"}
        </p>

        <p className="mt-2 uppercase">Comanda de cocina</p>

        <p className="my-5 border-y border-dashed border-outline py-5 text-muted">
          Los productos de cada pedido aparecerán aquí.
        </p>

        <p className="whitespace-pre-wrap break-words">
          {draft.kitchenTicketFooter}
        </p>

        <p className="mt-2 text-muted">SAZORA</p>
      </div>
    </section>
  );
}
