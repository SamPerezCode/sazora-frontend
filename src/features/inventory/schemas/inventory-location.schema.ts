import { z } from "zod";
import {
  baseUnitSchema,
  itemTypeSchema,
  stockStatusSchema,
} from "./inventory.schema";
import { fixed } from "../utils/inventory-value";

export const id = z.string().regex(/^[1-9]\d*$/);
export const numeric = z.string().regex(/^-?\d+(\.\d{1,6})?$/);

const nonnegative = (digits: number) =>
  z
    .string()
    .trim()
    .regex(
      new RegExp("^(?:0|[1-9]\\d*)(?:\\.\\d{1," + digits + "})?$"),
      "Usa punto decimal, sin separadores de miles."
    );

export const amount = nonnegative(6);

export const positive = amount.refine(
  (value) => fixed(value) > 0n,
  "El valor debe ser mayor que cero."
);

export const stockQuantity = nonnegative(3);

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable();

export const locationSchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
});

export const scopeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("BUSINESS"),
    location: z.null(),
  }),
  z.object({
    type: z.literal("LOCATION"),
    location: locationSchema,
  }),
]);

export const balanceSchema = z.object({
  inventoryItemId: id,
  sku: z.string().nullable(),
  name: z.string(),
  itemType: itemTypeSchema,
  baseUnit: baseUnitSchema,
  isItemActive: z.boolean(),
  location: locationSchema.extend({
    locationType: z.enum(["PRODUCTION_WAREHOUSE", "POINT_OF_SALE"]),
    isActive: z.boolean(),
  }),
  currentStock: numeric,
  minimumStock: numeric,
  stockStatus: stockStatusSchema,
  averageUnitCost: numeric.nullable(),
  inventoryValue: numeric.nullable(),
  valuationStatus: z.enum(["VALUED", "UNVALUED"]),
  migratedFromLegacy: z.boolean(),
});

export type Balance = z.infer<typeof balanceSchema>;

export const balancesSchema = z.object({
  scope: scopeSchema,
  balances: z.array(balanceSchema),
});

export const presentationSchema = z.object({
  id,
  inventoryItemId: id,
  inventoryItemName: z.string(),
  baseUnit: baseUnitSchema,
  name: z.string(),
  conversionFactor: numeric,
  isActive: z.boolean(),
});

export type Presentation = z.infer<typeof presentationSchema>;

export const summarySchema = z.object({
  generatedAt: z.string(),
  scope: scopeSchema,
  summary: z.object({
    locationCount: z.number(),
    balanceCount: z.number(),
    inStockCount: z.number(),
    lowStockCount: z.number(),
    outOfStockCount: z.number(),
    unvaluedStockCount: z.number(),
    totalInventoryValue: numeric.nullable(),
    hasUnvaluedStock: z.boolean(),
  }),
  byLocation: z.array(
    z.object({
      location: locationSchema,
      balanceCount: z.number(),
      unvaluedStockCount: z.number(),
      totalInventoryValue: numeric.nullable(),
    })
  ),
});

export const purchaseLineSchema = z.object({
  id,
  inventoryItemId: id,
  inventoryItemName: z.string(),
  baseUnit: baseUnitSchema,
  presentation: z.object({
    id,
    name: z.string(),
    conversionFactor: numeric,
  }),
  purchasedQuantity: numeric,
  baseQuantity: numeric,
  grossCost: numeric,
  discountAmount: numeric,
  additionalCostAmount: numeric,
  netCost: numeric,
  unitCost: numeric,
  balanceBefore: numeric,
  balanceAfter: numeric,
  averageUnitCostBefore: numeric.nullable(),
  averageUnitCostAfter: numeric,
  inventoryValueBefore: numeric.nullable(),
  inventoryValueAfter: numeric,
});

export const purchaseSchema = z.object({
  id,
  businessId: id,
  location: locationSchema,
  supplier: z
    .object({
      name: z.string(),
      document: z.string().nullable(),
    })
    .nullable(),
  externalReference: z.string().nullable(),
  documentDate: z.string().nullable(),
  notes: z.string().nullable(),
  costs: z.object({
    grossTotal: numeric,
    discountTotal: numeric,
    additionalCostTotal: numeric,
    netTotal: numeric,
  }),
  createdByName: z.string(),
  createdAt: z.string(),
  lines: z.array(purchaseLineSchema),
});

export type Purchase = z.infer<typeof purchaseSchema>;

export const purchaseRowSchema = z.object({
  movementId: id,
  movementLineId: id,
  location: locationSchema.nullable(),
  supplierName: z.string().nullable(),
  supplierDocument: z.string().nullable(),
  externalReference: z.string().nullable(),
  documentDate: z.string().nullable(),
  inventoryItemId: id,
  inventoryItemName: z.string(),
  baseUnit: baseUnitSchema,
  grossCost: numeric.nullable(),
  discountAmount: numeric.nullable(),
  additionalCostAmount: numeric.nullable(),
  netCost: numeric.nullable(),
  createdByName: z.string(),
  createdAt: z.string(),
});

export type PurchaseRow = z.infer<typeof purchaseRowSchema>;

export const purchaseReportSchema = z.object({
  scope: scopeSchema,
  period: z.object({
    from: z.string(),
    to: z.string(),
    timezone: z.string(),
  }),
  purchases: z.array(purchaseRowSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const itemInputSchema = z
  .object({
    locationId: id,
    name: z.string().trim().min(1).max(150),
    sku: nullableText(50),
    itemType: itemTypeSchema,
    baseUnit: baseUnitSchema,
    minimumStock: stockQuantity,
    openingQuantity: stockQuantity,
    openingUnitCost: positive.nullable(),
  })
  .superRefine((value, context) => {
    if (
      fixed(value.openingQuantity) > 0n !==
      (value.openingUnitCost !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["openingUnitCost"],
        message:
          "Una existencia inicial positiva requiere costo unitario.",
      });
    }
  });

export const editInputSchema = z.object({
  locationId: id,
  name: z.string().trim().min(1).max(150),
  sku: nullableText(50),
  itemType: itemTypeSchema,
  baseUnit: baseUnitSchema,
  minimumStock: stockQuantity,
});

export const purchaseInputSchema = z
  .object({
    locationId: id,
    supplierName: nullableText(160),
    supplierDocument: nullableText(80),
    externalReference: nullableText(120),
    documentDate: z.iso.date().nullable(),
    notes: nullableText(500),
    lines: z
      .array(
        z
          .object({
            inventoryItemId: id,
            presentationId: id,
            purchasedQuantity: stockQuantity.refine(
              (value) => fixed(value) > 0n,
              "La cantidad debe ser mayor que cero."
            ),
            grossCost: positive,
            discountAmount: amount,
            additionalCostAmount: amount,
            notes: nullableText(500),
          })
          .superRefine((value, context) => {
            if (
              fixed(value.discountAmount) > fixed(value.grossCost) ||
              fixed(value.grossCost) -
                fixed(value.discountAmount) +
                fixed(value.additionalCostAmount) <=
                0n
            ) {
              context.addIssue({
                code: "custom",
                message: "Revisa el descuento y el costo neto.",
              });
            }
          })
      )
      .min(1)
      .max(100),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.lines.map((line) => line.inventoryItemId))
        .size !== value.lines.length
    ) {
      context.addIssue({
        code: "custom",
        message: "No repitas artículos en la compra.",
      });
    }

    if (value.supplierDocument && !value.supplierName) {
      context.addIssue({
        code: "custom",
        path: ["supplierName"],
        message: "Indica el nombre del proveedor.",
      });
    }
  });

export type PurchaseInput = z.infer<typeof purchaseInputSchema>;

export const manualInputSchema = z
  .object({
    locationId: id,
    movementType: z.enum(["ADJUSTMENT", "WASTE", "RETURN"]),
    returnKind: z
      .enum(["CUSTOMER_RETURN", "SUPPLIER_RETURN"])
      .nullable(),
    externalReference: nullableText(120),
    notes: z
      .string()
      .trim()
      .min(1, "El motivo es obligatorio.")
      .max(500),
    lines: z
      .array(
        z.object({
          inventoryItemId: id,
          direction: z.enum(["IN", "OUT"]),
          quantity: stockQuantity.refine(
            (value) => fixed(value) > 0n,
            "La cantidad debe ser mayor que cero."
          ),
          unitCost: positive.nullable(),
          notes: nullableText(500),
        })
      )
      .min(1)
      .max(100),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.lines.map((line) => line.inventoryItemId))
        .size !== value.lines.length
    ) {
      context.addIssue({
        code: "custom",
        message: "No repitas artículos.",
      });
    }

    if (
      (value.movementType === "RETURN") !==
      (value.returnKind !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Revisa el tipo de devolución.",
      });
    }

    for (const line of value.lines) {
      if (
        ((value.movementType === "WASTE" ||
          value.returnKind === "SUPPLIER_RETURN") &&
          line.direction !== "OUT") ||
        (value.returnKind === "CUSTOMER_RETURN" &&
          line.direction !== "IN") ||
        (line.direction === "OUT" && line.unitCost !== null)
      ) {
        context.addIssue({
          code: "custom",
          message: "Revisa la dirección y el costo del movimiento.",
        });
      }
    }
  });
