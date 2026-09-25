import { z } from "zod";
import { API_BASE_URL } from "../../config/env";
import type { ApiFieldError } from "../../types/api";

const errorResponseSchema = z.object({
  status: z.literal("error"),
  code: z.string(),
  message: z.string(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      })
    )
    .default([]),
});

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: ApiFieldError[];

  constructor(
    status: number,
    code: string,
    message: string,
    errors: ApiFieldError[] = []
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
}

type UnauthorizedListener = (accessToken: string) => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export function subscribeToUnauthorized(
  listener: UnauthorizedListener
): () => void {
  unauthorizedListeners.add(listener);

  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {}
): Promise<T> {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }

  const timeoutSignal = AbortSignal.timeout(15_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  let response: Response;
  let payload: unknown;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
      credentials: "omit",
      signal,
    });

    payload = await response.json().catch(() => null);
  } catch (error: unknown) {
    if (options.signal?.aborted) {
      throw error;
    }

    throw new ApiError(
      0,
      timeoutSignal.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
      timeoutSignal.aborted
        ? "La solicitud tardó demasiado. Intenta nuevamente."
        : "No pudimos conectar con el servidor. Revisa tu conexión."
    );
  }

  options.signal?.throwIfAborted();

  if (timeoutSignal.aborted) {
    throw new ApiError(
      0,
      "REQUEST_TIMEOUT",
      "La solicitud tardó demasiado. Intenta nuevamente."
    );
  }

  if (!response.ok) {
    if (response.status === 401 && options.accessToken) {
      for (const listener of unauthorizedListeners) {
        listener(options.accessToken);
      }
    }

    const parsedError = errorResponseSchema.safeParse(payload);

    throw new ApiError(
      response.status,
      parsedError.success ? parsedError.data.code : "HTTP_ERROR",
      parsedError.success
        ? parsedError.data.message
        : "No fue posible completar la solicitud.",
      parsedError.success ? parsedError.data.errors : []
    );
  }

  const parsedResponse = schema.safeParse(payload);

  if (!parsedResponse.success) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "El servidor devolvió una respuesta inesperada."
    );
  }

  return parsedResponse.data;
}
