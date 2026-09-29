import type { z } from "zod";
import type { dashboardSchema } from "../schemas/dashboard.schema";

export type DashboardData = z.infer<typeof dashboardSchema>;

export type WeeklySale = DashboardData["weeklySales"][number];

export type DashboardOrder =
  DashboardData["ordersInProgress"][number];

export type InventoryItem =
  DashboardData["criticalInventory"][number];

export interface DashboardResource {
  data: DashboardData | null;
  loading: boolean;
  error: {
    message: string;
    status: number;
  } | null;
  refresh: () => void;
}
