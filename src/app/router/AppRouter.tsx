import { AccessPage } from "../../features/auth/pages/AccessPage";
import { LoginPage } from "../../features/auth/pages/LoginPage";
import { RoleSelectionPage } from "../../features/auth/pages/RoleSelectionPage";
import { ConfigurationPage } from "../../features/business/pages/ConfigurationPage";
import { CategoriesPage } from "../../features/categories/pages/CategoriesPage";
import { DashboardPage } from "../../features/dashboard/pages/DashboardPage";
import { InventoryPage } from "../../features/inventory/pages/InventoryPage";
import { KitchenPage } from "../../features/kitchen/pages/KitchenPage";
import { ProductsPage } from "../../features/products/pages/ProductsPage";
import { PublicMenuPage } from "../../features/public-menu/pages/PublicMenuPage";
import { PublicOrderTrackingPage } from "../../features/public-menu/pages/PublicOrderTrackingPage";
import { ReportsPage } from "../../features/reports/ReportsPage";
import { DeliveriesPage } from "../../features/sales/pages/DeliveriesPage";
import { PublicOrdersPage } from "../../features/sales/pages/PublicOrdersPage";
import { SalesPage } from "../../features/sales/pages/SalesPage";
import { CashPage } from "../../features/cash/pages/CashPage";
import { FinancialSalesPage } from "../../features/sales/pages/FinancialSalesPage";
import { AppShell } from "../layout/AppShell";
import { GuestOnly } from "./AuthGuards";
import { RequireAccess } from "./AuthGuards";
import { RequireAuth } from "./AuthGuards";
import { SessionBoundary } from "./AuthGuards";
import { SessionHome } from "./AuthGuards";
import { Navigate } from "react-router";
import { Route } from "react-router";
import { Routes } from "react-router";

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/menu/:businessSlug"
        element={<PublicMenuPage />}
      />

      <Route
        path="/menu/:businessSlug/pedido/:publicCode"
        element={<PublicOrderTrackingPage />}
      />

      <Route element={<SessionBoundary />}>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route
          path="/seleccionar-rol"
          element={<RoleSelectionPage />}
        />

        <Route element={<RequireAuth />}>
          <Route element={<RequireAccess />}>
            <Route element={<AppShell />}>
              <Route path="/panel" element={<DashboardPage />} />
              <Route path="/estadisticas" element={<ReportsPage />} />
              <Route path="/ventas" element={<SalesPage />} />
              <Route path="/cajas" element={<CashPage />} />
              <Route
                path="/historial-ventas"
                element={<FinancialSalesPage />}
              />{" "}
              <Route
                path="/pedidos-publicos"
                element={<PublicOrdersPage />}
              />
              <Route
                path="/domicilios"
                element={<DeliveriesPage />}
              />{" "}
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
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<SessionHome />} />
        <Route path="*" element={<SessionHome />} />
      </Route>
    </Routes>
  );
}
