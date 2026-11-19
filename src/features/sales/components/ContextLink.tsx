import type { ReactNode } from "react";

import { Link, useLocation } from "react-router";

const resourceParam: Record<string, string> = {
  "/pedidos-publicos": "solicitud",
  "/ventas": "orderId",
  "/domicilios": "deliveryId",
};

export function ContextLink({
  to,
  children,
  className = "por-link",
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  const location = useLocation();

  let target = to;

  const origin: unknown = location.state?.operationFrom;

  if (
    typeof origin === "string" &&
    origin.startsWith("/") &&
    !origin.startsWith("//")
  ) {
    const previous = new URL(origin, window.location.origin);

    const next = new URL(to, window.location.origin);

    const key = resourceParam[next.pathname];

    if (
      previous.origin === window.location.origin &&
      key &&
      previous.pathname === next.pathname &&
      next.searchParams.get(key) &&
      previous.searchParams.get(key) === next.searchParams.get(key)
    ) {
      target = previous.pathname + previous.search;
    }
  }

  return (
    <Link
      className={className}
      to={target}
      state={{
        operationFrom: location.pathname + location.search,
      }}
    >
      {children}
    </Link>
  );
}
