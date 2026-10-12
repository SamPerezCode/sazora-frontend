import { Navigate, Route, Routes } from "react-router";
import { LoginPage } from "../../features/auth/pages/LoginPage";
import { DashboardPage } from "../../features/dashboard/pages/DashboardPage";
import { AppShell } from "../layout/AppShell";
import { CategoriesPage } from "../../features/categories/pages/CategoriesPage";
import { ProductsPage } from "../../features/products/pages/ProductsPage";
import { SalesPage } from "../../features/sales/pages/SalesPage";
import { KitchenPage } from "../../features/kitchen/pages/KitchenPage";
import { InventoryPage } from "../../features/inventory/pages/InventoryPage";
import { ConfigurationPage } from "../../features/business/pages/ConfigurationPage";

import {
  GuestOnly,
  RequireAuth,
  RequireRole,
  SessionBoundary,
} from "./AuthGuards";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<SessionBoundary />}>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/panel" element={<DashboardPage />} />
            <Route path="/ventas" element={<SalesPage />} />
            <Route path="/cocina" element={<KitchenPage />} />
            <Route path="/panel" element={<DashboardPage />} />

            <Route
              path="/productos/categorias"
              element={
                <RequireRole role="ADMIN">
                  <CategoriesPage />
                </RequireRole>
              }
            />
            <Route
              path="/inventario"
              element={
                <RequireRole role="ADMIN">
                  <InventoryPage />
                </RequireRole>
              }
            />
            <Route
              path="/mi-negocio"
              element={<Navigate to="/configuracion" replace />}
            />

            <Route
              path="/configuracion"
              element={
                <RequireRole role="ADMIN">
                  <ConfigurationPage />
                </RequireRole>
              }
            />

            <Route
              path="/productos"
              element={
                <RequireRole role="ADMIN">
                  <ProductsPage />
                </RequireRole>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  );
}
