import { Navigate, Route, Routes } from "react-router";
import { LoginPage } from "../../features/auth/pages/LoginPage";
import { DashboardPage } from "../../features/dashboard/pages/DashboardPage";
import { AppShell } from "../layout/AppShell";
import {
  GuestOnly,
  RequireAuth,
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
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  );
}
