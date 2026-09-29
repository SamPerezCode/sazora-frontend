import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../lib/http/client";
import {
  SECTION_FIELDS,
  sectionSchemas,
  selectSection,
  toBusinessDraft,
} from "../business-settings.schema";
import type {
  BusinessDraft,
  BusinessSettings,
  BusinessSettingsResource,
  SettingsSection,
} from "../business-settings.schema";

interface Notice {
  errors: Record<string, string>;
  message: string;
  success: boolean;
}

const emptyNotice: Notice = {
  errors: {},
  message: "",
  success: false,
};

export function useSettingsEditor(
  settings: BusinessSettings,
  resource: BusinessSettingsResource
) {
  const [active, setActive] =
    useState<SettingsSection>("information");

  const [draft, setDraft] = useState(() => toBusinessDraft(settings));

  const [notices, setNotices] = useState<
    Record<SettingsSection, Notice>
  >({
    information: emptyNotice,
    brand: emptyNotice,
    ticket: emptyNotice,
    menu: emptyNotice,
  });

  const [selection, setSelection] = useState<{
    file: File;
    url: string;
  } | null>(null);

  const [logoNotice, setLogoNotice] = useState("");
  const [logoError, setLogoError] = useState(false);
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (selection) {
        URL.revokeObjectURL(selection.url);
      }
    },
    [selection]
  );

  const baseline = toBusinessDraft(settings);

  const dirty = (section: SettingsSection) =>
    SECTION_FIELDS[section].some(
      (key) => draft[key] !== baseline[key]
    );

  function change<K extends keyof BusinessDraft>(
    key: K,
    value: BusinessDraft[K]
  ): void {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "publicMenuEnabled" && value === false
        ? { publicOrderingEnabled: false }
        : {}),
    }));

    setNotices((previous) => ({
      ...previous,
      [active]: emptyNotice,
    }));
  }

  function resetColors(): void {
    setDraft((previous) => ({
      ...previous,
      primaryColor: settings.primaryColor,
      accentColor: settings.accentColor,
    }));

    setNotices((previous) => ({
      ...previous,
      brand: emptyNotice,
    }));
  }

  async function save(
    section: SettingsSection,
    form: HTMLFormElement
  ): Promise<void> {
    if (resource.busy || !dirty(section)) return;

    const result = sectionSchemas[section].safeParse(draft);

    if (!result.success) {
      const errors: Record<string, string> = {};

      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        errors[key] ??= issue.message;
      }

      setNotices((previous) => ({
        ...previous,
        [section]: {
          errors,
          message: "Revisa los campos indicados.",
          success: false,
        },
      }));

      requestAnimationFrame(() => {
        if (form.isConnected) {
          form
            .querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus();
        }
      });

      return;
    }

    setNotices((previous) => ({
      ...previous,
      [section]: emptyNotice,
    }));

    try {
      const saved = await resource.mutate({
        kind: "settings",
        patch: result.data,
      });

      if (!alive.current) return;

      setDraft((previous) => ({
        ...previous,
        ...selectSection(section, toBusinessDraft(saved)),
      }));

      setNotices((previous) => ({
        ...previous,
        [section]: {
          errors: {},
          message: "Cambios guardados.",
          success: true,
        },
      }));
    } catch (error: unknown) {
      if (!alive.current) return;

      const errors: Record<string, string> = {};

      if (error instanceof ApiError) {
        for (const issue of error.errors) {
          errors[issue.field] ??= issue.message;
        }
      }

      setNotices((previous) => ({
        ...previous,
        [section]: {
          errors,
          success: false,
          message:
            error instanceof ApiError
              ? error.message
              : "No pudimos guardar los cambios.",
        },
      }));
    }
  }

  function selectLogo(file: File | undefined): void {
    if (!file || resource.busy) return;

    setLogoNotice("");
    setLogoError(false);

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        file.type
      ) ||
      file.size > 5 * 1024 * 1024 ||
      file.size === 0
    ) {
      setSelection(null);
      setLogoError(true);
      setLogoNotice(
        "Selecciona una imagen JPEG, PNG o WebP de hasta 5 MB."
      );

      return;
    }

    setSelection({
      file,
      url: URL.createObjectURL(file),
    });
  }

  async function saveLogo(remove = false): Promise<void> {
    if (resource.busy || (!remove && !selection)) return;

    if (
      remove &&
      !window.confirm(
        "¿Eliminar el logo del negocio? Se mostrarán sus iniciales."
      )
    ) {
      return;
    }

    setLogoNotice("");
    setLogoError(false);

    try {
      await resource.mutate({
        kind: "logo",
        file: remove ? null : selection!.file,
      });

      if (!alive.current) return;

      setSelection(null);
      setLogoNotice(remove ? "Logo eliminado." : "Logo guardado.");
    } catch (error: unknown) {
      if (!alive.current) return;

      setLogoError(true);
      setLogoNotice(
        error instanceof ApiError
          ? error.message
          : "No pudimos actualizar el logo."
      );
    }
  }

  return {
    active,
    setActive,
    draft,
    change,
    dirty,
    resetColors,
    save,
    notice: notices[active],
    selection,
    clearSelection: () => setSelection(null),
    selectLogo,
    saveLogo,
    logoNotice,
    logoError,
  };
}
