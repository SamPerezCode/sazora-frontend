import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../../../lib/http/client";
import { errorText } from "../utils/production.utils";
import type { Recipe } from "../schemas/recipe.schemas";

export function useRecipeMutation(onSaved: (recipe: Recipe) => void) {
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function run(
    action: (signal: AbortSignal) => Promise<Recipe>
  ) {
    if (lock.current || locked) return;

    lock.current = true;
    setBusy(true);
    setError("");

    const request = new AbortController();
    controller.current = request;

    try {
      const recipe = await action(request.signal);

      if (!request.signal.aborted) {
        onSaved(recipe);
      }
    } catch (caught) {
      if (request.signal.aborted) return;

      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      setLocked(
        uncertain ||
          (caught instanceof ApiError &&
            [401, 403, 404].includes(caught.status))
      );

      setError(
        errorText(caught) +
          (uncertain
            ? "\nNo pudimos confirmar el resultado. Cierra y revisa el listado antes de volver a guardar."
            : "")
      );
    } finally {
      lock.current = false;

      if (!request.signal.aborted) {
        setBusy(false);
      }
    }
  }

  return { busy, locked, error, setError, run };
}
