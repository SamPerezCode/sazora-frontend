type Relation = {
  requestId?: string;
  orderId?: string;
  deliveryId?: string;
};

type Listener = (keys: readonly string[]) => void;

type Store = {
  requests: Map<string, string>;
  deliveries: Map<string, Relation>;
  tickets: Map<string, string>;
  versions: Map<string, number>;
  revision: number;
  listeners: Set<Listener>;
};

const stores = new Map<string, Store>();

const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[1-9]\d*$/.test(value);

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const operationKeys = {
  requests: "requests",
  orders: "orders",
  deliveries: "deliveries",
  kitchen: "kitchen",

  request: (id: string) => "requests:" + id,
  order: (id: string) => "orders:" + id,
  payment: (id: string) => "payments:" + id,
  preparation: (id: string) => "kitchen:" + id,
  delivery: (id: string) => "deliveries:" + id,
};

function store(token: string): Store {
  let current = stores.get(token);

  if (!current) {
    current = {
      requests: new Map(),
      deliveries: new Map(),
      tickets: new Map(),
      versions: new Map(),
      revision: 0,
      listeners: new Set(),
    };

    stores.set(token, current);
  }

  return current;
}

export function keysIntersect(a: string, b: string) {
  return (
    a === "*" ||
    b === "*" ||
    a === b ||
    (a.endsWith(":*") &&
      (b === a.slice(0, -2) || b.startsWith(a.slice(0, -1)))) ||
    (b.endsWith(":*") &&
      (a === b.slice(0, -2) || a.startsWith(b.slice(0, -1))))
  );
}

export function subscribeOperations(
  token: string,
  listener: Listener
) {
  const current = store(token);

  current.listeners.add(listener);

  return () => {
    current.listeners.delete(listener);
  };
}

export function invalidateOperations(
  token: string,
  keys: readonly string[]
) {
  if (!token || !keys.length) return;

  const current = store(token);

  current.revision++;

  for (const key of keys) {
    current.versions.set(key, current.revision);
  }

  if (current.versions.size > 4000) {
    current.versions.clear();
    current.versions.set("*", current.revision);
  }

  for (const listener of current.listeners) {
    listener(keys);
  }
}

export function clearOperations() {
  stores.clear();
}

export function knownRequest(token: string, orderId: string) {
  const matches = [...store(token).requests].filter(
    ([, value]) => value === orderId
  );

  return matches.length === 1 ? matches[0][0] : null;
}

function remember(token: string, payload: unknown) {
  const current = store(token);
  const data = object(object(payload).data);

  const requests = [
    data.request,
    ...(Array.isArray(data.requests) ? data.requests : []),
  ];

  for (const value of requests) {
    const row = object(value);

    if (!validId(row.id)) continue;

    if (validId(row.orderId)) {
      current.requests.set(row.id, row.orderId);
    } else {
      current.requests.delete(row.id);
    }
  }

  const deliveries = [
    data.delivery,
    ...(Array.isArray(data.deliveries) ? data.deliveries : []),
  ];

  for (const value of deliveries) {
    const row = object(value);

    if (
      validId(row.id) &&
      validId(row.orderId) &&
      validId(row.publicOrderRequestId)
    ) {
      current.deliveries.set(row.id, {
        deliveryId: row.id,
        orderId: row.orderId,
        requestId: row.publicOrderRequestId,
      });

      current.requests.set(row.publicOrderRequestId, row.orderId);
    }
  }

  const history = object(data.kitchenHistory);

  const tickets = Array.isArray(data.kitchenTickets)
    ? data.kitchenTickets
    : Array.isArray(history.tickets)
      ? history.tickets
      : [];

  for (const value of tickets) {
    const row = object(value);
    const orderId = row.orderId ?? history.orderId;

    if (validId(row.id) && validId(orderId)) {
      current.tickets.set(row.id, orderId);
    }
  }

  for (const map of [
    current.requests,
    current.deliveries,
    current.tickets,
  ]) {
    while (map.size > 2000) {
      map.delete(map.keys().next().value!);
    }
  }
}

export function invalidateRelated(token: string, relation: Relation) {
  const current = store(token);

  const orderId =
    relation.orderId ??
    (relation.requestId
      ? current.requests.get(relation.requestId)
      : undefined) ??
    (relation.deliveryId
      ? current.deliveries.get(relation.deliveryId)?.orderId
      : undefined);

  const keys = new Set<string>();

  if (relation.requestId) {
    keys.add(operationKeys.request(relation.requestId));
  }

  if (relation.deliveryId) {
    keys.add(operationKeys.delivery(relation.deliveryId));
  }

  if (orderId) {
    keys.add(operationKeys.order(orderId));
    keys.add(operationKeys.payment(orderId));
    keys.add(operationKeys.preparation(orderId));

    for (const [id, order] of current.requests) {
      if (order === orderId) {
        keys.add(operationKeys.request(id));
      }
    }

    for (const [id, delivery] of current.deliveries) {
      if (delivery.orderId === orderId) {
        keys.add(operationKeys.delivery(id));
      }
    }
  }

  if (orderId || relation.deliveryId) {
    keys.add("orders");
    keys.add("deliveries");
    keys.add("kitchen");
  }

  if (keys.size) {
    keys.add("requests");
  }

  invalidateOperations(token, [...keys]);
}

export function observeOperation(
  token: string,
  path: string,
  payload: unknown,
  write: boolean
) {
  if (
    !token ||
    !/^\/(orders|public-order-requests|deliveries|kitchen-tickets)(\/|\?|$)/.test(
      path
    )
  ) {
    return;
  }

  remember(token, payload);

  if (!write) return;

  const parts = path.split("?")[0].split("/").filter(Boolean);

  const current = store(token);
  const data = object(object(payload).data);

  const order = object(data.order);
  const request = object(data.request);
  const delivery = object(data.delivery);

  const relation: Relation = {};

  if (validId(order.id)) {
    relation.orderId = order.id;
  }

  if (validId(data.orderId)) {
    relation.orderId = data.orderId;
  }

  if (validId(request.id)) {
    relation.requestId = request.id;
  }

  if (validId(delivery.id)) {
    relation.deliveryId = delivery.id;
  }

  if (parts[0] === "orders" && validId(parts[1])) {
    relation.orderId = parts[1];
  }

  if (parts[0] === "public-order-requests" && validId(parts[1])) {
    relation.requestId = parts[1];
  }

  if (parts[0] === "deliveries") {
    if (validId(parts[1])) {
      relation.deliveryId = parts[1];
    } else if (
      parts[1] === "public-order-requests" &&
      validId(parts[2])
    ) {
      relation.requestId = parts[2];
    }
  }

  if (parts[0] === "kitchen-tickets" && validId(parts[1])) {
    relation.orderId ??= current.tickets.get(parts[1]);
  }

  if (relation.orderId || relation.requestId || relation.deliveryId) {
    invalidateRelated(token, relation);
  } else {
    // La respuesta no permite identificar el recurso afectado.
    invalidateOperations(token, [
      "orders:*",
      "requests:*",
      "deliveries:*",
      "kitchen:*",
    ]);
  }
}

export function readOperationStamp(token: string, path: string) {
  const parts = path.split("?")[0].split("/").filter(Boolean);

  const family = {
    orders: "orders",
    "public-order-requests": "requests",
    deliveries: "deliveries",
    "kitchen-tickets": "kitchen",
  }[parts[0]];

  if (!family) return 0;

  let key = validId(parts[1]) ? family + ":" + parts[1] : family;

  if (parts[0] === "orders" && parts[2] === "payments") {
    key = "payments:" + parts[1];
  }

  if (parts[0] === "orders" && parts[2] === "kitchen-history") {
    key = "kitchen:" + parts[1];
  }

  let revision = 0;

  for (const [changed, version] of store(token).versions) {
    if (keysIntersect(key, changed)) {
      revision = Math.max(revision, version);
    }
  }

  return revision;
}
