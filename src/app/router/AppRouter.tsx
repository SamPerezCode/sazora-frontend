import { Navigate, Route, Routes } from "react-router";
import { LoginPage } from "../../features/auth/pages/LoginPage";
import { AccessPage } from "../../features/auth/pages/AccessPage";
import { DashboardPage } from "../../features/dashboard/pages/DashboardPage";
import { CategoriesPage } from "../../features/categories/pages/CategoriesPage";
import { ProductsPage } from "../../features/products/pages/ProductsPage";
import { SalesPage } from "../../features/sales/pages/SalesPage";
import { KitchenPage } from "../../features/kitchen/pages/KitchenPage";
import { InventoryPage } from "../../features/inventory/pages/InventoryPage";
import { ConfigurationPage } from "../../features/business/pages/ConfigurationPage";
import { ReportsPage } from "../../features/reports/ReportsPage";
import { AppShell } from "../layout/AppShell";
import {
  GuestOnly,
  RequireAuth,
  RequireAccess,
  SessionBoundary,
  SessionHome,
} from "./AuthGuards";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<SessionBoundary />}>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<RequireAccess />}>
            <Route element={<AppShell />}>
              <Route path="/panel" element={<DashboardPage />} />
              <Route path="/estadisticas" element={<ReportsPage />} />
              <Route path="/ventas" element={<SalesPage />} />
              <Route path="/cocina" element={<KitchenPage />} />
              <Route path="/inventario" element={<InventoryPage />} />
              <Route path="/productos" element={<ProductsPage />} />
              <Route
                path="/productos/categorias"
                element={<CategoriesPage />}
              />
              <Route
                path="/configuracion"
                element={<ConfigurationPage />}
              />
              <Route
                path="/mi-negocio"
                element={<Navigate to="/configuracion" replace />}
              />

              <Route path="/acceso" element={<AccessPage />} />
              <Route path="/espacios" element={<AccessPage />} />
              <Route path="/produccion" element={<AccessPage />} />
              <Route
                path="/pedidos-publicos"
                element={<AccessPage />}
              />
              <Route path="/domicilios" element={<AccessPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<SessionHome />} />
        <Route path="*" element={<SessionHome />} />
      </Route>
    </Routes>
  );
}
