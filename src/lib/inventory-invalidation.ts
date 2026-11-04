type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribeInventoryInvalidation(
  businessId: string,
  listener: Listener
) {
  const group = listeners.get(businessId) ?? new Set<Listener>();

  group.add(listener);
  listeners.set(businessId, group);

  return () => {
    group.delete(listener);

    if (!group.size) {
      listeners.delete(businessId);
    }
  };
}

export function invalidateInventory(businessId: string) {
  listeners.get(businessId)?.forEach((listener) => listener());
}
