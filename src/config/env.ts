import { z } from "zod";

const environmentSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:3000/api"),
});

const environment = environmentSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
});

export const API_BASE_URL = environment.VITE_API_BASE_URL.replace(
  /\/+$/,
  ""
);
