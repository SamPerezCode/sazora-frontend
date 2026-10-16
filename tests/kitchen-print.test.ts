import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/lib/http/client";

import {
  createPrintStore,
  currentInitialPrint,
} from "../src/features/kitchen-flow/kitchen-print.store";

import {
  initialPrintBody,
  kitchenWorkflowModeSchema,
  reprintInputSchema,
  resolveKitchenMode,
} from "../src/features/kitchen-flow/kitchen-flow.schema";

import type {
  KitchenPrint,
  PrintTicket,
} from "../src/features/kitchen-flow/kitchen-flow.schema";

import type { KitchenPrintApi } from "../src/features/kitchen-flow/kitchen-flow.service";

const scope = {
  businessId: "1",
  location: {
    id: "2",
    name: "Sede de prueba",
    code: "PV-01",
  },
};

function ticket(id = "10", version = 1): PrintTicket {
  return {
    id,
    orderId: "38",
    preparationAreaId: "4",
    preparationAreaName: "Cocina caliente",
    currentVersion: version,
  };
}

function print(
  source: PrintTicket,
  printType: KitchenPrint["printType"] = "INITIAL",
  id = "100"
): KitchenPrint {
  return {
    id,
    businessId: "1",
    kitchenTicketId: source.id,
    printedByMembershipId: "3",
    ticketVersion: source.currentVersion,
    printType,
    reason: printType === "INITIAL" ? null : "Adición",
    printerName: null,
    createdAt: "2026-10-15T15:00:00.000Z",
    contentSnapshot: {
      businessId: "1",
      businessName: "Sazora",
      kitchenTicketFooter: "Gracias",
      kitchenTicketId: source.id,
      orderId: source.orderId,
      preparationAreaId: source.preparationAreaId,
      preparationAreaName: source.preparationAreaName,
      ticketVersion: source.currentVersion,
      serviceType: "TABLE",
      restaurantTableCode: "MESA-01",
      restaurantTableName: "Mesa 1",
      orderNotes: null,
      generatedAt: "2026-10-15T15:00:00.000Z",
      items: [],
    },
  };
}

function setup() {
  const api: KitchenPrintApi = {
    history: vi.fn(async () => []),
    initial: vi.fn(async (value) => print(value)),
    reprint: vi.fn(async (value) => print(value, "REPRINT", "101")),
  };

  return {
    api,
    store: createPrintStore(scope, api),
  };
}

describe("Modo de cocina", () => {
  it("admite null para una orden OPEN", () => {
    expect(
      kitchenWorkflowModeSchema.nullable().parse(null)
    ).toBeNull();
  });

  it("el borrador utiliza la configuración de la sede", () => {
    expect(
      resolveKitchenMode(
        { status: "OPEN", kitchenWorkflowMode: null },
        "PRINT_ONLY"
      )
    ).toBe("PRINT_ONLY");
  });

  it("una orden confirmada conserva el modo que recibió", () => {
    expect(
      resolveKitchenMode(
        { status: "CONFIRMED", kitchenWorkflowMode: "PRINT_ONLY" },
        "PRINT_AND_SCREEN"
      )
    ).toBe("PRINT_ONLY");
  });

  it("no inventa un modo para una confirmada con modo desconocido", () => {
    expect(
      resolveKitchenMode(
        { status: "CONFIRMED", kitchenWorkflowMode: null },
        "PRINT_ONLY"
      )
    ).toBeNull();
  });
});

describe("Impresiones", () => {
  it("la versión inicial envía reason null", () => {
    expect(initialPrintBody(1)).toEqual({
      reason: null,
      printerName: null,
    });
  });

  it("una versión posterior incluye motivo", () => {
    expect(initialPrintBody(2).reason).toBe(
      "Adición enviada a cocina"
    );
  });

  it("registra una impresión inicial", async () => {
    const { store, api } = setup();

    await store.send(ticket());

    expect(api.initial).toHaveBeenCalledTimes(1);
    expect(store.list("38")[0].status).toBe("SENT");
  });

  it("un fallo deja únicamente esa comanda en ERROR", async () => {
    const { store, api } = setup();

    vi.mocked(api.initial).mockRejectedValueOnce(
      new Error("Sin red")
    );

    await store.send(ticket());

    expect(store.list("38")[0].status).toBe("ERROR");
    expect(api.reprint).not.toHaveBeenCalled();
  });

  it("conserva los éxitos parciales", async () => {
    const { store, api } = setup();

    vi.mocked(api.initial).mockImplementation(async (value) => {
      if (value.id === "11") throw new Error("Sin red");
      return print(value);
    });

    await store.sendAll([ticket("10"), ticket("11")]);

    const statuses = new Map(
      store.list("38").map((entry) => [entry.ticket.id, entry.status])
    );

    expect(statuses.get("10")).toBe("SENT");
    expect(statuses.get("11")).toBe("ERROR");
  });

  it("el reintento global procesa solo errores", async () => {
    const { store, api } = setup();

    vi.mocked(api.initial).mockImplementation(async (value) => {
      if (value.id === "11") throw new Error("Sin red");
      return print(value);
    });

    await store.sendAll([ticket("10"), ticket("11")]);

    vi.mocked(api.initial).mockClear();
    vi.mocked(api.initial).mockImplementation(async (value) =>
      print(value)
    );

    await store.retryFailed("38");

    expect(api.initial).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.initial).mock.calls[0][0].id).toBe("11");
  });

  it("el reintento individual no toca otra comanda", async () => {
    const { store, api } = setup();

    vi.mocked(api.initial).mockRejectedValue(new Error("Sin red"));

    await store.sendAll([ticket("10"), ticket("11")]);

    vi.mocked(api.initial).mockClear();
    vi.mocked(api.initial).mockImplementation(async (value) =>
      print(value)
    );

    await store.send(ticket("10"));

    expect(api.initial).toHaveBeenCalledTimes(1);
    expect(
      store.list("38").find((entry) => entry.ticket.id === "11")
        ?.status
    ).toBe("ERROR");
  });

  it("reconcilia VERSION_ALREADY_PRINTED consultando historial", async () => {
    const { store, api } = setup();
    const value = ticket();

    vi.mocked(api.initial).mockRejectedValue(
      new ApiError(
        409,
        "KITCHEN_TICKET_VERSION_ALREADY_PRINTED",
        "Ya existe"
      )
    );

    vi.mocked(api.history).mockResolvedValue([print(value)]);

    expect(await store.send(value)).toBe(true);
    expect(store.list("38")[0].status).toBe("SENT");
  });

  it("una reconstrucción sin registros muestra PENDING", async () => {
    const { store } = setup();

    await store.restore(ticket());

    expect(store.list("38")[0].status).toBe("PENDING");
  });

  it("un fallo al leer historial no inventa un fallo de impresión", async () => {
    const { store, api } = setup();

    vi.mocked(api.history).mockRejectedValue(new Error("Sin red"));

    await store.restore(ticket());

    expect(store.list("38")[0].status).toBe("PENDING");
    expect(store.list("38")[0].historyError).toBe("Sin red");
  });

  it("una impresión exitosa no vuelve a usar /prints", async () => {
    const { store, api } = setup();

    await store.send(ticket());
    await store.send(ticket());

    expect(api.initial).toHaveBeenCalledTimes(1);
  });

  it("evita dos envíos simultáneos de la misma comanda", async () => {
    const { store, api } = setup();
    const value = ticket();

    let finish!: (result: KitchenPrint) => void;

    vi.mocked(api.initial).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const first = store.send(value);
    const second = await store.send(value);

    expect(second).toBe(false);
    expect(api.initial).toHaveBeenCalledTimes(1);

    finish(print(value));
    await first;
  });

  it("una nueva versión utiliza impresión inicial, no reimpresión", async () => {
    const { store, api } = setup();

    await store.send(ticket("10", 1));
    await store.send(ticket("10", 2));

    expect(api.initial).toHaveBeenCalledTimes(2);
    expect(api.reprint).not.toHaveBeenCalled();
    expect(store.list("38")[0].ticket.currentVersion).toBe(2);
  });

  it("exige motivo para reimprimir", () => {
    expect(
      reprintInputSchema.safeParse({
        reason: "   ",
        printerName: null,
      }).success
    ).toBe(false);
  });

  it("reimprimir usa la operación de reimpresión y conserva el original", async () => {
    const { store, api } = setup();
    const value = ticket();

    await store.send(value);

    const original = currentInitialPrint(store.list("38")[0])!;

    await store.reprint(value, original, "Comanda dañada", null);

    expect(api.initial).toHaveBeenCalledTimes(1);
    expect(api.reprint).toHaveBeenCalledWith(
      value,
      original,
      "Comanda dañada",
      null
    );

    expect(
      store.list("38")[0].prints.map((entry) => entry.id)
    ).toEqual(expect.arrayContaining(["100", "101"]));
  });

  it("una copia por sí sola no sustituye el registro inicial", async () => {
    const { store, api } = setup();
    const value = ticket();

    vi.mocked(api.history).mockResolvedValue([
      print(value, "REPRINT"),
    ]);

    await store.restore(value);

    expect(store.list("38")[0].status).toBe("PENDING");
  });

  it("no mezcla comandas de distintas órdenes", async () => {
    const { store } = setup();

    await store.send(ticket("10"));
    await store.send({
      ...ticket("11"),
      orderId: "39",
    });

    expect(store.list("38")).toHaveLength(1);
    expect(store.list("39")).toHaveLength(1);
  });
});
