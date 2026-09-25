import { Navigate, Route, Routes } from "react-router";
import { LoginPage } from "../../features/auth/pages/LoginPage";
import { SessionPage } from "../../features/auth/pages/SessionPage";
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
          <Route path="/panel" element={<SessionPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  );
}
