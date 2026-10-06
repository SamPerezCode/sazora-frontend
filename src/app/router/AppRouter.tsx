import { Navigate, Route, Routes } from "react-router";
import { LoginPage } from "../../features/auth/pages/LoginPage";
import { DashboardPage } from "../../features/dashboard/pages/DashboardPage";
import { BusinessSettingsPage } from "../../features/business/pages/BusinessSettingsPage";
import { AppShell } from "../layout/AppShell";
import { CategoriesPage } from "../../features/categories/pages/CategoriesPage";
import { ProductsPage } from "../../features/products/pages/ProductsPage";
import { SalesPage } from "../../features/sales/pages/SalesPage";
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

            <Route
              path="/productos/categorias"
              element={
                <RequireRole role="ADMIN">
                  <CategoriesPage />
                </RequireRole>
              }
            />

            <Route
              path="/mi-negocio"
              element={
                <RequireRole role="ADMIN">
                  <BusinessSettingsPage />
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
