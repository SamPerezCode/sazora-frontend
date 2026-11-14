import { z } from "zod";
import { saleId, saleDetailSchema } from "./financial-sales.schema";

export const voidSaleInput = z
  .object({
    cashSessionId: saleId,
    reason: z
      .string()
      .trim()
      .min(5, "El motivo debe tener al menos 5 caracteres.")
      .max(500, "El motivo no puede superar 500 caracteres."),
  })
  .strict();

export type VoidSaleInput = z.infer<typeof voidSaleInput>;
export type VoidableSale = z.infer<typeof saleDetailSchema>;
