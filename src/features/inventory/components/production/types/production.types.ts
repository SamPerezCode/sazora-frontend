import type { z } from "zod";
import type { movementDetail } from "../../../schemas/inventory-audit.schema";

import type {
  orderSchema,
  orderSummarySchema,
  editOrderSchema,
  completeOrderSchema,
  wasteInputSchema,
} from "../schemas/production.schemas";

import type { orderResources } from "../services/production.queries";

export type Order = z.infer<typeof orderSchema>;

export type OrderSummary = z.infer<typeof orderSummarySchema>;

export type Status = Order["status"];

export type Action =
  | "detail"
  | "edit"
  | "plan"
  | "start"
  | "cancel"
  | "complete"
  | "waste"
  | "performance"
  | "movement";

export type Mutation =
  | {
      action: "edit";
      payload: z.infer<typeof editOrderSchema>;
    }
  | {
      action: "complete";
      payload: z.infer<typeof completeOrderSchema>;
    }
  | {
      action: "waste";
      payload: z.infer<typeof wasteInputSchema>;
    }
  | {
      action: "plan" | "start";
      payload: { version: number };
    }
  | {
      action: "cancel";
      payload: {
        version: number;
        cancellationReason: string;
      };
    };

export type OrderResources = Awaited<
  ReturnType<typeof orderResources>
>;

export interface FormContext {
  data: OrderResources;
  currency: string;
  zone: string;
  busy: boolean;
  locked: boolean;
  error: string;
  onClose: () => void;
  commit: (mutation: Mutation) => Promise<void>;
}

export type CreationKind = "quick" | "order";

export type QuickLine = {
  key: string;
  inventoryItemId: string;
  quantity: string;
  notes: string;
  costAllocationPercentage: string;
};

export interface ProductionCreateProps {
  kind: CreationKind;
  initialLocationId: string;
  currency: string;
  zone: string;
  onClose: () => void;
  onOrderSaved: (order: Order) => void;
  onQuickSaved: (movement: z.infer<typeof movementDetail>) => void;
  onRefresh: () => void;
}
