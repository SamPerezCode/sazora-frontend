import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { ApiError } from "../../../lib/http/client";
import type { ApiFieldError } from "../../../types/api";
import { loginSchema } from "../schemas/auth.schema";
import { ORGANIZATION_SLUG } from "../../../config/env";
import type {
  LoginFieldErrors,
  LoginRequest,
} from "../types/auth.types";
import { useAuth } from "./useAuth";

function getFieldErrors(
  issues: readonly ApiFieldError[]
): LoginFieldErrors {
  const errors: LoginFieldErrors = {};

  for (const { field, message } of issues) {
    if (
      field === "businessSlug" ||
      field === "email" ||
      field === "password"
    ) {
      errors[field] ??= message;
    }
  }

  return errors;
}

function focusFirstError(
  form: HTMLFormElement,
  errors: LoginFieldErrors
): void {
  requestAnimationFrame(() => {
    if (!form.isConnected) {
      return;
    }

    for (const field of [
      "businessSlug",
      "email",
      "password",
    ] as const) {
      if (errors[field]) {
        const input = form.elements.namedItem(field);

        if (input instanceof HTMLElement) {
          input.focus();
        }

        return;
      }
    }
  });
}

export function useLoginForm() {
  const { login } = useAuth();

  const [values, setValues] = useState<LoginRequest>(() => ({
    businessSlug: ORGANIZATION_SLUG,
    email: "",
    password: "",
  }));

  const [errors, setErrors] = useState<LoginFieldErrors>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requestController = useRef<AbortController | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    return () => {
      requestController.current?.abort();
    };
  }, []);

  function setField(field: keyof LoginRequest, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage("");
  }

  async function handleSubmit(
    event: SubmitEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    if (pending.current) {
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ORGANIZATION_SLUG)) {
      setMessage(
        "Esta instalación no tiene configurado el acceso. Contacta al administrador."
      );
      return;
    }

    const form = event.currentTarget;
    const result = loginSchema.safeParse(values);

    setMessage("");

    if (!result.success) {
      const fieldErrors = getFieldErrors(
        result.error.issues.map((issue) => ({
          field: String(issue.path[0]),
          message: issue.message,
        }))
      );

      setErrors(fieldErrors);
      focusFirstError(form, fieldErrors);
      return;
    }

    setErrors({});
    pending.current = true;
    setSubmitting(true);

    const controller = new AbortController();
    requestController.current = controller;

    try {
      await login(result.data, controller.signal);
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      if (error instanceof ApiError) {
        const fieldErrors = getFieldErrors(error.errors);
        setErrors(fieldErrors);
        setMessage(error.message);
        focusFirstError(form, fieldErrors);
      } else {
        setMessage(
          "No fue posible iniciar sesión. Intenta nuevamente."
        );
      }
    } finally {
      pending.current = false;

      if (!controller.signal.aborted) {
        setSubmitting(false);
      }
    }
  }

  return {
    values,
    errors,
    message,
    submitting,
    setField,
    handleSubmit,
  };
}
