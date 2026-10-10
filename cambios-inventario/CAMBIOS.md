# Combos e inventario en tiempo real

Código preparado para aplicar manualmente. Los parches no se han aplicado a src.

## Orden

1. Aplicar backend.patch en sazora-api.
2. Aplicar frontend.patch en sazora-web.
3. Reiniciar el backend y recargar la app.

El backend expone canBeComboComponent, rechaza inventory-setup para combos y emite inventory:changed a los administradores del mismo negocio tras respuestas satisfactorias de operaciones que pueden afectar el inventario.

El frontend filtra componentes elegibles, exige 2–100 componentes y cantidades enteras de 1–10.000, trata los combos como consumo de componentes y recarga Inventario y Productos al recibir cambios. Agrupa eventos durante 500 ms, espera a cerrar los diálogos, vuelve a consultar al reconectar o recuperar el foco y consulta cada 60 segundos mientras la página está visible.

La notificación es de invalidación: el frontend vuelve a consultar la API, no modifica existencias a partir del mensaje. No es un registro durable de movimientos. No se alteran registros existentes ni se requieren migraciones.

## Validación

Comprobaciones estáticas sobre el código propuesto: TypeScript sin errores en el backend; frontend sin errores nuevos en los archivos afectados y conserva siete errores ajenos a este cambio. ESLint sin errores en los archivos modificados de ambos proyectos. Las pruebas integrales de ventas, cancelaciones y producción quedan pendientes.

## Código por archivo

### [notify-inventory-changes.ts](../../sazora-api/src/middlewares/notify-inventory-changes.ts)

Archivo nuevo.

```ts
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { getRealtimeServer } from "../realtime/realtime.server";
import { getBusinessRoleRoom } from "../realtime/realtime.rooms";

const writes = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const resources = new Set([
  "inventory-items",
  "inventory-movements",
  "product-inventory-links",
  "production",
  "products",
  "orders",
  "public-order-requests",
]);

// Evento de invalidación: no representa un movimiento ni una cantidad.
export const notifyInventoryChanges: RequestHandler = (request, response, next) => {
  const resource = request.path.split("/")[1];

  if (!writes.has(request.method) || !resource || !resources.has(resource)) {
    next();
    return;
  }

  response.once("finish", () => {
    const auth = request.auth;
    if (!auth || response.statusCode < 200 || response.statusCode >= 300) return;

    // Los controladores responden después de terminar sus transacciones.
    // Un fallo de Socket.IO no convierte un guardado exitoso en un error.
    try {
      getRealtimeServer()
        .to(getBusinessRoleRoom(auth.businessId, "ADMIN"))
        .emit("inventory:changed", {
          eventId: randomUUID(),
          businessId: auth.businessId,
          occurredAt: new Date().toISOString(),
        });
    } catch (error) {
      console.error("No se pudo emitir inventory:changed", error);
    }
  });

  next();
};
```

### [useInventoryRealtime.ts](../src/features/inventory/hooks/useInventoryRealtime.ts)

Archivo nuevo.

```ts
import { useEffect, useEffectEvent } from "react";
import { z } from "zod";
import type { AuthSession } from "../../auth/types/auth.types";
import { acquireSessionSocket } from "../../../lib/realtime/session-socket";

const eventSchema = z.object({
  eventId: z.string().uuid(),
  businessId: z.string(),
  occurredAt: z.iso.datetime({ offset: true }),
});

export function useInventoryRealtime(
  session: AuthSession,
  onInvalidate: () => void
) {
  const invalidate = useEffectEvent(onInvalidate);
  const accessToken = session.accessToken;
  const businessId = session.business.id;
  const membershipId = session.membership.id;
  const userId = session.user.id;
  const allowed = session.authorization.roles.includes("ADMIN");

  useEffect(() => {
    if (!allowed) return;

    const lease = acquireSessionSocket({
      accessToken, businessId, membershipId, userId,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;
    const seen = new Set<string>();

    function schedule() {
      pending = true;
      if (timer === undefined) timer = setTimeout(flush, 500);
    }

    function flush() {
      timer = undefined;
      if (!pending || document.visibilityState !== "visible") return;

      // Conserva los formularios y sus borradores hasta cerrar el modal.
      if (document.querySelector("dialog[open]")) {
        timer = setTimeout(flush, 500);
        return;
      }

      pending = false;
      invalidate();
    }

    function receive(raw: unknown) {
      if (lease.getStatus() !== "connected") return;
      const result = eventSchema.safeParse(raw);
      if (!result.success || result.data.businessId !== businessId) return;
      if (seen.has(result.data.eventId)) return;

      seen.add(result.data.eventId);
      if (seen.size > 200) seen.delete(seen.values().next().value!);
      schedule();
    }

    function connectionChanged(status: string) {
      if (status === "connected") schedule();
    }

    function visible() {
      if (document.visibilityState === "visible") schedule();
    }

    lease.socket.on("inventory:changed", receive);
    const unsubscribe = lease.subscribe(connectionChanged);
    // También cubre un socket compartido que ya estaba conectado.
    timer = setTimeout(() => {
      timer = undefined;
      connectionChanged(lease.getStatus());
    }, 0);

    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);

    // Recupera eventos perdidos. No exige una entrega durable del socket.
    const interval = setInterval(visible, 60_000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
      lease.socket.off("inventory:changed", receive);
      unsubscribe();
      lease.release();
    };
  }, [accessToken, businessId, membershipId, userId, allowed]);
}
```

### [product.types.ts](../../sazora-api/src/modules/products/product.types.ts)

Archivo modificado; el parche conserva el resto de su código.

```ts
type ProductFulfillmentMode = "PREPARE_TO_ORDER" | "READY_TO_SERVE";

type ProductInventoryTrackingType =
  "NONE" | "RESALE" | "PRODUCTION" | "COMBO" | "CUSTOM";

type Product = Readonly<{
  id: string;
  businessId: string;
  categoryId: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  sku: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  currentPrice: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type ProductListItem = Product &
  Readonly<{
    categoryName: string;
    categoryIsActive: boolean;
    preparationAreaName: string;
    preparationAreaIsActive: boolean;
    isAvailable: boolean;
    isCombo: boolean;
    hasInventory: boolean;
    canBeComboComponent: boolean;
    inventoryTrackingType: ProductInventoryTrackingType;
  }>;

type CreateProductData = Readonly<{
  categoryId: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  sku: string | null;
  name: string;
  description: string | null;
  currentPrice: string;
}>;

type UpdateProductData = Readonly<{
  categoryId: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  sku: string | null;
  name: string;
  description: string | null;
  currentPrice: string;
}>;

export type {
  CreateProductData,
  Product,
  ProductFulfillmentMode,
  ProductInventoryTrackingType,
  ProductListItem,
  UpdateProductData,
};
```

### [product.repository.ts](../../sazora-api/src/modules/products/repositories/product.repository.ts)

Archivo modificado; el parche conserva el resto de su código.

```ts
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  CreateProductData,
  Product,
  ProductFulfillmentMode,
  ProductInventoryTrackingType,
  ProductListItem,
  UpdateProductData,
} from "../product.types";

type ProductRow = RowDataPacket & {
  id: string;
  businessId: string;
  categoryId: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  sku: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  currentPrice: string;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

type ProductListRow = ProductRow & {
  categoryName: string;
  categoryIsActive: number;
  preparationAreaName: string;
  preparationAreaIsActive: number;
  isAvailable: number;
  isCombo: number;
  hasInventory: number;
  canBeComboComponent: number;
  inventoryTrackingType: ProductInventoryTrackingType;
};

const mapProductRow = (row: ProductRow): Product => ({
  id: row.id,
  businessId: row.businessId,
  categoryId: row.categoryId,
  preparationAreaId: row.preparationAreaId,
  fulfillmentMode: row.fulfillmentMode,
  sku: row.sku,
  name: row.name,
  description: row.description,
  imageUrl: row.imageUrl,
  currentPrice: row.currentPrice,
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const mapProductListRow = (row: ProductListRow): ProductListItem => ({
  ...mapProductRow(row),
  categoryName: row.categoryName,
  categoryIsActive: Boolean(row.categoryIsActive),
  preparationAreaName: row.preparationAreaName,
  preparationAreaIsActive: Boolean(row.preparationAreaIsActive),
  isAvailable: Boolean(row.isAvailable),
  isCombo: Boolean(row.isCombo),
  hasInventory: Boolean(row.hasInventory),
  canBeComboComponent: Boolean(row.canBeComboComponent),
  inventoryTrackingType: row.inventoryTrackingType,
});

const productListSelect = `
  SELECT
    CAST(p.id AS CHAR) AS id,
    CAST(p.business_id AS CHAR)
      AS businessId,
    CAST(p.category_id AS CHAR)
      AS categoryId,
    CAST(p.preparation_area_id AS CHAR)
      AS preparationAreaId,
    p.fulfillment_mode AS fulfillmentMode,
    p.sku,
    p.name,
    p.description,
    p.image_url AS imageUrl,
    CAST(p.current_price AS CHAR)
      AS currentPrice,
    p.is_active AS isActive,
    p.created_at AS createdAt,
    p.updated_at AS updatedAt,
    c.name AS categoryName,
    c.is_active AS categoryIsActive,
    pa.name AS preparationAreaName,
    pa.is_active AS preparationAreaIsActive,

    (
      p.is_active = TRUE
      AND c.is_active = TRUE
      AND pa.is_active = TRUE
    ) AS isAvailable,

    EXISTS (
      SELECT 1
      FROM product_combo_components AS pcc
      WHERE
        pcc.business_id = p.business_id
        AND pcc.combo_product_id = p.id
    ) AS isCombo,

    EXISTS (
      SELECT 1
      FROM product_inventory_links AS pil
      WHERE
        pil.business_id = p.business_id
        AND pil.product_id = p.id
        AND pil.is_active = TRUE
    ) AS hasInventory,

    (
      p.is_active = TRUE
      AND EXISTS (
        SELECT 1
        FROM product_inventory_links AS pil
        INNER JOIN inventory_items AS ii
          ON ii.business_id = pil.business_id
          AND ii.id = pil.inventory_item_id
          AND ii.is_active = TRUE
        WHERE pil.business_id = p.business_id
          AND pil.product_id = p.id
          AND pil.is_active = TRUE
          AND pil.auto_deduct = TRUE
      )
    ) AS canBeComboComponent,

    CASE
      WHEN EXISTS (
        SELECT 1
        FROM product_combo_components AS pcc
        WHERE
          pcc.business_id = p.business_id
          AND pcc.combo_product_id = p.id
      )
        THEN 'COMBO'

      WHEN NOT EXISTS (
        SELECT 1
        FROM product_inventory_links AS pil
        WHERE
          pil.business_id = p.business_id
          AND pil.product_id = p.id
          AND pil.is_active = TRUE
      )
        THEN 'NONE'

      WHEN NOT EXISTS (
        SELECT 1
        FROM product_inventory_links AS pil
        INNER JOIN inventory_items AS ii
          ON ii.business_id = pil.business_id
          AND ii.id = pil.inventory_item_id
        WHERE
          pil.business_id = p.business_id
          AND pil.product_id = p.id
          AND pil.is_active = TRUE
          AND ii.item_type <> 'RESALE_GOOD'
      )
        THEN 'RESALE'

      WHEN NOT EXISTS (
        SELECT 1
        FROM product_inventory_links AS pil
        INNER JOIN inventory_items AS ii
          ON ii.business_id = pil.business_id
          AND ii.id = pil.inventory_item_id
        WHERE
          pil.business_id = p.business_id
          AND pil.product_id = p.id
          AND pil.is_active = TRUE
          AND ii.item_type <> 'FINISHED_GOOD'
      )
        THEN 'PRODUCTION'

      ELSE 'CUSTOM'
    END AS inventoryTrackingType

  FROM products AS p
  INNER JOIN categories AS c
    ON c.business_id = p.business_id
    AND c.id = p.category_id
  INNER JOIN preparation_areas AS pa
    ON pa.business_id = p.business_id
    AND pa.id = p.preparation_area_id
`;

const findProductById = async (
  businessId: string,
  productId: string,
): Promise<Product | null> => {
  const [rows] = await databasePool.execute<ProductRow[]>(
    `
        SELECT
          CAST(id AS CHAR) AS id,
          CAST(business_id AS CHAR)
            AS businessId,
          CAST(category_id AS CHAR)
            AS categoryId,
          CAST(preparation_area_id AS CHAR)
            AS preparationAreaId,
          fulfillment_mode
            AS fulfillmentMode,
          sku,
          name,
          description,
          image_url AS imageUrl,
          CAST(current_price AS CHAR)
            AS currentPrice,
          is_active AS isActive,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM products
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
      `,
    [businessId, productId],
  );

  const product = rows[0];

  return product ? mapProductRow(product) : null;
};

const createProduct = async (
  businessId: string,
  data: CreateProductData,
  imageUrl: string | null = null,
): Promise<Product> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
        INSERT INTO products (
          business_id,
          category_id,
          preparation_area_id,
          fulfillment_mode,
          sku,
          name,
          description,
          image_url,
          current_price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    [
      businessId,
      data.categoryId,
      data.preparationAreaId,
      data.fulfillmentMode,
      data.sku,
      data.name,
      data.description,
      imageUrl,
      data.currentPrice,
    ],
  );

  const product = await findProductById(businessId, result.insertId.toString());

  if (!product) {
    throw new Error("No fue posible recuperar el producto creado");
  }

  return product;
};

const findProductsByBusinessId = async (
  businessId: string,
): Promise<ProductListItem[]> => {
  const [rows] = await databasePool.execute<ProductListRow[]>(
    `
        ${productListSelect}
        WHERE p.business_id = ?
        ORDER BY
          p.name ASC,
          p.id ASC
      `,
    [businessId],
  );

  return rows.map(mapProductListRow);
};

const findProductDetailById = async (
  businessId: string,
  productId: string,
): Promise<ProductListItem | null> => {
  const [rows] = await databasePool.execute<ProductListRow[]>(
    `
        ${productListSelect}
        WHERE
          p.business_id = ?
          AND p.id = ?
        LIMIT 1
      `,
    [businessId, productId],
  );

  const product = rows[0];

  return product ? mapProductListRow(product) : null;
};

const updateProduct = async (
  businessId: string,
  productId: string,
  data: UpdateProductData,
): Promise<Product> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE products
      SET
        category_id = ?,
        preparation_area_id = ?,
        fulfillment_mode = ?,
        sku = ?,
        name = ?,
        description = ?,
        current_price = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [
      data.categoryId,
      data.preparationAreaId,
      data.fulfillmentMode,
      data.sku,
      data.name,
      data.description,
      data.currentPrice,
      businessId,
      productId,
    ],
  );

  const product = await findProductById(businessId, productId);

  if (!product) {
    throw new Error("No fue posible recuperar el producto actualizado");
  }

  return product;
};

const updateProductStatus = async (
  businessId: string,
  productId: string,
  isActive: boolean,
): Promise<Product> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE products
      SET is_active = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [isActive, businessId, productId],
  );

  const product = await findProductById(businessId, productId);

  if (!product) {
    throw new Error("No fue posible recuperar el producto actualizado");
  }

  return product;
};

const updateProductImage = async (
  businessId: string,
  productId: string,
  imageUrl: string | null,
): Promise<Product> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE products
      SET image_url = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [imageUrl, businessId, productId],
  );

  const product = await findProductById(businessId, productId);

  if (!product) {
    throw new Error("No fue posible recuperar el producto actualizado");
  }

  return product;
};

export {
  createProduct,
  findProductById,
  findProductDetailById,
  findProductsByBusinessId,
  updateProduct,
  updateProductImage,
  updateProductStatus,
};
```

### [configure-product-inventory.repository.ts](../../sazora-api/src/modules/product-inventory-links/repositories/configure-product-inventory.repository.ts)

Archivo modificado; el parche conserva el resto de su código.

```ts
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { ConfigureProductInventoryInput } from "../schemas/configure-product-inventory.schema";

type ProductSetupRow = RowDataPacket & {
  id: string;
  name: string;
  isActive: number;
};

type ExistingLinkRow = RowDataPacket & {
  id: string;
};

type ConfigureProductInventoryResult =
  | Readonly<{ kind: "COMBO_NOT_ALLOWED" }>
  | Readonly<{
      kind: "CONFIGURED";
      inventoryItemId: string;
      productInventoryLinkId: string;
    }>
  | Readonly<{
      kind: "PRODUCT_NOT_AVAILABLE";
    }>
  | Readonly<{
      kind: "ALREADY_CONFIGURED";
      productInventoryLinkId: string;
    }>;

const configureProductInventoryRecord = async (
  businessId: string,
  membershipId: string,
  productId: string,
  data: ConfigureProductInventoryInput,
): Promise<ConfigureProductInventoryResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [productRows] = await connection.execute<ProductSetupRow[]>(
      `
          SELECT
            CAST(id AS CHAR) AS id,
            name,
            is_active AS isActive
          FROM products
          WHERE
            business_id = ?
            AND id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, productId],
    );

    const product = productRows[0];

    if (product?.isActive !== 1) {
      await connection.rollback();

      return {
        kind: "PRODUCT_NOT_AVAILABLE",
      };
    }

    const [comboRows] = await connection.execute<RowDataPacket[]>(
      `SELECT combo_product_id
       FROM product_combo_components
       WHERE business_id = ? AND combo_product_id = ?
       LIMIT 1 FOR UPDATE`,
      [businessId, productId],
    );

    if (comboRows.length > 0) {
      await connection.rollback();
      return { kind: "COMBO_NOT_ALLOWED" };
    }

    const [existingLinkRows] = await connection.execute<ExistingLinkRow[]>(
      `
          SELECT CAST(id AS CHAR) AS id
          FROM product_inventory_links
          WHERE
            business_id = ?
            AND product_id = ?
          ORDER BY id ASC
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, productId],
    );

    const existingLink = existingLinkRows[0];

    if (existingLink) {
      await connection.rollback();

      return {
        kind: "ALREADY_CONFIGURED",
        productInventoryLinkId: existingLink.id,
      };
    }

    const inventoryItemType =
      data.trackingType === "RESALE" ? "RESALE_GOOD" : "FINISHED_GOOD";

    const [inventoryItemResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO inventory_items (
            business_id,
            sku,
            name,
            item_type,
            base_unit,
            current_stock,
            minimum_stock
          )
          VALUES (?, ?, ?, ?, ?, 0.000, ?)
        `,
      [
        businessId,
        data.sku,
        product.name,
        inventoryItemType,
        data.baseUnit,
        data.minimumStock,
      ],
    );

    const inventoryItemId = inventoryItemResult.insertId.toString();

    if (Number(data.openingQuantity) > 0) {
      const [openingMovementResult] = await connection.execute<ResultSetHeader>(
        `
            INSERT INTO inventory_movements (
              business_id,
              movement_type,
              source_type,
              source_id,
              notes,
              created_by_membership_id
            )
            VALUES (
              ?,
              'OPENING',
              'INVENTORY_ITEM',
              ?,
              ?,
              ?
            )
          `,
        [
          businessId,
          inventoryItemId,
          `Existencia inicial de ${product.name}`,
          membershipId,
        ],
      );

      const openingMovementId = openingMovementResult.insertId.toString();

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO inventory_movement_lines (
            business_id,
            movement_id,
            inventory_item_id,
            direction,
            quantity,
            balance_before,
            balance_after,
            notes
          )
          VALUES (
            ?,
            ?,
            ?,
            'IN',
            ?,
            0.000,
            ?,
            ?
          )
        `,
        [
          businessId,
          openingMovementId,
          inventoryItemId,
          data.openingQuantity,
          data.openingQuantity,
          `Existencia inicial de ${product.name}`,
        ],
      );

      await connection.execute<ResultSetHeader>(
        `
          UPDATE inventory_items
          SET current_stock = ?
          WHERE
            business_id = ?
            AND id = ?
        `,
        [data.openingQuantity, businessId, inventoryItemId],
      );
    }

    const [linkResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO product_inventory_links (
            business_id,
            product_id,
            inventory_item_id,
            quantity_per_product,
            auto_deduct,
            is_active
          )
          VALUES (?, ?, ?, ?, TRUE, TRUE)
        `,
      [businessId, productId, inventoryItemId, data.quantityPerProduct],
    );

    const productInventoryLinkId = linkResult.insertId.toString();

    await connection.commit();

    return {
      kind: "CONFIGURED",
      inventoryItemId,
      productInventoryLinkId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { configureProductInventoryRecord };

export type { ConfigureProductInventoryResult };
```

### [configure-product-inventory.service.ts](../../sazora-api/src/modules/product-inventory-links/services/configure-product-inventory.service.ts)

Archivo modificado; el parche conserva el resto de su código.

```ts
import { AppError } from "../../../shared/errors/app-error";
import type { InventoryItem } from "../../inventory-items/inventory-item.types";
import { findInventoryItemById } from "../../inventory-items/repositories/inventory-item.repository";
import type { Product } from "../../products/product.types";
import { findProductById } from "../../products/repositories/product.repository";
import type { ProductInventoryLink } from "../product-inventory-link.types";
import { findProductInventoryLinkById } from "../repositories/product-inventory-link.repository";
import { configureProductInventoryRecord } from "../repositories/configure-product-inventory.repository";
import type { ConfigureProductInventoryInput } from "../schemas/configure-product-inventory.schema";

type ProductInventorySetup = Readonly<{
  trackingType: "RESALE" | "PRODUCTION";
  product: Product;
  inventoryItem: InventoryItem;
  link: ProductInventoryLink;
}>;

const configureProductInventory = async (
  businessId: string,
  membershipId: string,
  productId: string,
  input: ConfigureProductInventoryInput,
): Promise<ProductInventorySetup> => {
  const result = await configureProductInventoryRecord(
    businessId,
    membershipId,
    productId,
    input,
  );

  if (result.kind === "PRODUCT_NOT_AVAILABLE") {
    throw new AppError(
      "El producto no existe o está inactivo",
      404,
      "PRODUCT_NOT_AVAILABLE",
    );
  }

  if (result.kind === "COMBO_NOT_ALLOWED") {
    throw new AppError(
      "Los combos consumen el inventario de sus componentes. Edita su composición.",
      409,
      "COMBO_INVENTORY_SETUP_NOT_ALLOWED",
    );
  }

  if (result.kind === "ALREADY_CONFIGURED") {
    throw new AppError(
      `El producto ya administra inventario mediante la relación ${result.productInventoryLinkId}`,
      409,
      "PRODUCT_INVENTORY_ALREADY_CONFIGURED",
    );
  }

  const [product, inventoryItem, link] = await Promise.all([
    findProductById(businessId, productId),

    findInventoryItemById(businessId, result.inventoryItemId),

    findProductInventoryLinkById(businessId, result.productInventoryLinkId),
  ]);

  if (!product || !inventoryItem || !link) {
    throw new Error(
      "No fue posible recuperar la configuración de inventario creada",
    );
  }

  return {
    trackingType: input.trackingType,
    product,
    inventoryItem,
    link,
  };
};

export { configureProductInventory };

export type { ProductInventorySetup };
```

### [realtime.types.ts](../../sazora-api/src/realtime/realtime.types.ts)

Archivo modificado; el parche conserva el resto de su código.

```ts
import type { Socket } from "socket.io";

import type { AccessTokenPayload } from "../modules/auth/auth.types";

interface SessionReadyPayload {
  userId: string;
  businessId: string;
  membershipId: string;
  roles: string[];
  connectedAt: string;
}

interface SessionPingPayload {
  serverTime: string;
}

interface KitchenTicketCreatedSummary {
  id: string;
  preparationAreaId: string;
  currentVersion: number;
  orderItemIds: readonly string[];
}

interface OrderCreatedPayload {
  businessId: string;
  orderId: string;
  restaurantTableId: string | null;
  openedByMembershipId: string;
  serviceType: "TABLE" | "TAKEAWAY" | "DELIVERY";
  status: "OPEN";
  customerCount: number | null;
  notes: string | null;
  createdAt: string;
}

interface OrderConfirmedPayload {
  businessId: string;
  orderId: string;
  status: "CONFIRMED";
  confirmedAt: string | null;
  kitchenTickets: readonly KitchenTicketCreatedSummary[];
}

interface KitchenTicketItemStatusUpdatedPayload {
  businessId: string;
  orderId: string;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  preparationStatus:
    "PENDING" | "IN_PREPARATION" | "READY" | "DELIVERED" | "CANCELLED";
  orderDelivered: boolean;
  updatedAt: string;
}

type RealtimeOrderStatus =
  "OPEN" | "CONFIRMED" | "DELIVERED" | "CLOSED" | "CANCELLED";

interface OrderStatusUpdatedPayload {
  businessId: string;
  orderId: string;
  previousStatus: RealtimeOrderStatus;
  status: RealtimeOrderStatus;
  changedByMembershipId: string;
  changedAt: string;
}

interface OrderItemAddedPayloadItem {
  id: string;
  productId: string;
  preparationAreaId: string;
  fulfillmentMode: "PREPARE_TO_ORDER" | "READY_TO_SERVE";
  productName: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
}

interface OrderItemsAddedPayload {
  businessId: string;
  orderId: string;
  orderStatus: RealtimeOrderStatus;
  addedByMembershipId: string;
  orderItems: readonly OrderItemAddedPayloadItem[];
}

interface OrderItemUpdatedPayload {
  businessId: string;
  orderId: string;
  orderItemId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  notes: string | null;
  updatedAt: string;
}

interface OrderItemRemovedPayload {
  businessId: string;
  orderId: string;
  orderItemId: string;
  removedAt: string;
}

interface OrderItemCancelledPayload {
  businessId: string;
  orderId: string;
  orderItemId: string;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  kitchenTicketVersion: number;
  preparationStatus: "CANCELLED";
  orderStatus: RealtimeOrderStatus;
  cancellationReason: string;
  cancelledByMembershipId: string;
  cancelledAt: string;
}

interface OrderUpdatedPayload {
  businessId: string;
  orderId: string;
  status: RealtimeOrderStatus;
  serviceType: "TABLE" | "TAKEAWAY" | "DELIVERY";
  restaurantTableId: string | null;
  customerCount: number | null;
  notes: string | null;
  changedByMembershipId: string;
  updatedAt: string;
}

interface PublicOrderRequestCreatedPayload {
  businessId: string;
  requestId: string;
  publicCode: string;
  serviceType: "DELIVERY" | "TAKEAWAY";
  customerName: string;
  customerPhone: string;
  itemCount: number;
  subtotal: string;
  createdAt: string;
  recipientMembershipIds: readonly string[];
}

interface ClientToServerEvents {
  "session:ping": (acknowledge: (payload: SessionPingPayload) => void) => void;
}
interface PublicOrderRequestOrderConfirmedPayload {
  businessId: string;
  requestId: string;
  publicCode: string;
  orderId: string;
  orderStatus: "CONFIRMED";
  serviceType: "DELIVERY" | "TAKEAWAY";
  confirmedByMembershipId: string;
  confirmedAt: string | null;
  kitchenTickets: readonly KitchenTicketCreatedSummary[];
}

interface PublicOrderRequestPreparationUpdatedPayload {
  businessId: string;
  requestId: string;
  publicCode: string;
  orderId: string;
  serviceType: "DELIVERY" | "TAKEAWAY";
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  preparationStatus:
    "PENDING" | "IN_PREPARATION" | "READY" | "DELIVERED" | "CANCELLED";
  orderStatus: "CONFIRMED" | "DELIVERED";
  orderDelivered: boolean;
  updatedAt: string;
}

interface PublicOrderRequestOrderClosedPayload {
  businessId: string;
  requestId: string;
  publicCode: string;
  orderId: string;
  serviceType: "DELIVERY" | "TAKEAWAY";
  orderStatus: "CLOSED";
  closedByMembershipId: string;
  closedAt: string;
}

interface DeliveryStatusUpdatedPayload {
  businessId: string;
  deliveryId: string;
  requestId: string;
  publicCode: string;
  orderId: string;
  previousStatus:
    | "PENDING_ASSIGNMENT"
    | "ASSIGNED"
    | "PICKED_UP"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED";
  status:
    | "PENDING_ASSIGNMENT"
    | "ASSIGNED"
    | "PICKED_UP"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED";
  deliveryMode: "INTERNAL" | "EXTERNAL" | null;
  externalProviderName: string | null;
  assignedDriverMembershipId: string | null;
  changedAt: string;
}

export interface InventoryChangedPayload {
  eventId: string;
  businessId: string;
  occurredAt: string;
}

interface ServerToClientEvents {
  "inventory:changed": (payload: InventoryChangedPayload) => void;
  "public-order-request:created": (
    payload: PublicOrderRequestCreatedPayload,
  ) => void;
  "session:ready": (payload: SessionReadyPayload) => void;
  "order:created": (payload: OrderCreatedPayload) => void;
  "order:confirmed": (payload: OrderConfirmedPayload) => void;
  "kitchen-ticket:item-status-updated": (
    payload: KitchenTicketItemStatusUpdatedPayload,
  ) => void;
  "order:status-updated": (payload: OrderStatusUpdatedPayload) => void;
  "order:items-added": (payload: OrderItemsAddedPayload) => void;
  "order:item-updated": (payload: OrderItemUpdatedPayload) => void;
  "order:item-removed": (payload: OrderItemRemovedPayload) => void;
  "order:item-cancelled": (payload: OrderItemCancelledPayload) => void;
  "order:updated": (payload: OrderUpdatedPayload) => void;
  "public-order-request:status-updated": (
    payload: PublicOrderRequestStatusUpdatedPayload,
  ) => void;
  "public-order-request:order-confirmed": (
    payload: PublicOrderRequestOrderConfirmedPayload,
  ) => void;
  "public-order-request:preparation-updated": (
    payload: PublicOrderRequestPreparationUpdatedPayload,
  ) => void;
  "public-order-request:order-closed": (
    payload: PublicOrderRequestOrderClosedPayload,
  ) => void;
  "delivery:status-updated": (payload: DeliveryStatusUpdatedPayload) => void;
  "order:item-quantity-cancelled": (
    payload: OrderItemQuantityCancelledPayload,
  ) => void;
}

type InterServerEvents = Record<never, never>;

interface SocketData {
  auth: AccessTokenPayload;
}

type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface PublicOrderRequestStatusUpdatedPayload {
  businessId: string;
  requestId: string;
  publicCode: string;
  previousStatus: "NEW" | "CONTACTED" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  status: "NEW" | "CONTACTED" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  handledByMembershipId: string | null;
  orderId: string | null;
  changedAt: string;
}

interface OrderItemQuantityCancelledPayload {
  businessId: string;
  orderId: string;
  orderItemId: string;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  kitchenTicketVersion: number;
  previousQuantity: number;
  cancelledQuantity: number;
  remainingQuantity: number;
  preparationStatus: "PENDING" | "IN_PREPARATION" | "READY";
  cancellationReason: string;
  cancelledByMembershipId: string;
  adjustedAt: string;
}

export type {
  ClientToServerEvents,
  InterServerEvents,
  KitchenTicketCreatedSummary,
  KitchenTicketItemStatusUpdatedPayload,
  OrderConfirmedPayload,
  OrderCreatedPayload,
  OrderItemAddedPayloadItem,
  OrderItemCancelledPayload,
  OrderItemQuantityCancelledPayload,
  OrderItemRemovedPayload,
  OrderItemsAddedPayload,
  OrderItemUpdatedPayload,
  OrderStatusUpdatedPayload,
  OrderUpdatedPayload,
  RealtimeOrderStatus,
  RealtimeSocket,
  ServerToClientEvents,
  SessionPingPayload,
  SessionReadyPayload,
  SocketData,
  PublicOrderRequestCreatedPayload,
  PublicOrderRequestStatusUpdatedPayload,
  PublicOrderRequestOrderConfirmedPayload,
  PublicOrderRequestPreparationUpdatedPayload,
  PublicOrderRequestOrderClosedPayload,
  DeliveryStatusUpdatedPayload,
};
```

### [app.ts](../../sazora-api/src/app.ts)

Archivo modificado; el parche conserva el resto de su código.

```ts
import { resolve } from "node:path";

import cors from "cors";
import express from "express";

import { environment } from "./config/env";
import { errorHandler } from "./middlewares/error-handler";
import { notFound } from "./middlewares/not-found";
import { apiRouter } from "./routes";
import { notifyInventoryChanges } from "./middlewares/notify-inventory-changes";

const app = express();

app.use(
  cors({
    origin: environment.CLIENT_ORIGIN,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);

app.use(express.json());

app.use("/uploads", express.static(resolve(process.cwd(), "uploads")));

app.use("/api", notifyInventoryChanges, apiRouter);

app.use(notFound);
app.use(errorHandler);

export { app };
```

### [product.schema.ts](../src/features/products/schemas/product.schema.ts)

Archivo modificado; el parche conserva el resto de su código.

```ts
import { z } from "zod";

export const productIdSchema = z.string().regex(/^[1-9]\d*$/);

export const fulfillmentModeSchema = z.enum([
  "PREPARE_TO_ORDER",
  "READY_TO_SERVE",
]);

export const inventoryTrackingSchema = z.enum([
  "NONE",
  "RESALE",
  "PRODUCTION",
  "COMBO",
  "CUSTOM",
]);

export const productDetailSchema = z.object({
  id: productIdSchema,
  businessId: productIdSchema,
  categoryId: productIdSchema,
  preparationAreaId: productIdSchema,
  fulfillmentMode: fulfillmentModeSchema,
  sku: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  currentPrice: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  isActive: z.boolean(),
  isCombo: z.boolean().optional(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
});

export const productSchema = productDetailSchema.extend({
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  categoryName: z.string(),
  preparationAreaName: z.string(),
  categoryIsActive: z.boolean().optional(),
  preparationAreaIsActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  isCombo: z.boolean(),
  hasInventory: z.boolean(),
  canBeComboComponent: z.boolean().default(false),
  inventoryTrackingType: inventoryTrackingSchema,
});

export const productListSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    products: z.array(productSchema),
    pagination: z
      .object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
      })
      .optional(),
  }),
});

export const productDetailResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    product: productDetailSchema,
  }),
});

export type Product = z.infer<typeof productSchema>;
export type ProductDetailData = z.infer<typeof productDetailSchema>;
```

### [product-action.schema.ts](../src/features/products/schemas/product-action.schema.ts)

Archivo modificado; el parche conserva el resto de su código.

```ts
import { z } from "zod";
import {
  fulfillmentModeSchema,
  productDetailSchema,
  productIdSchema,
} from "./product.schema";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

export const productEditSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre.").max(150),
  sku: optionalText(50),
  description: optionalText(500),
  currentPrice: z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .pipe(
      z
        .string()
        .regex(
          /^\d+(?:\.\d{1,2})?$/,
          "Usa un importe con máximo dos decimales."
        )
    ),
  categoryId: productIdSchema,
  preparationAreaId: productIdSchema,
  fulfillmentMode: fulfillmentModeSchema,
});

export const componentsSchema = z
  .array(
    z.object({
      productId: productIdSchema,
      quantity: z
        .number()
        .finite()
        .int("Usa cantidades enteras.")
        .positive("La cantidad debe ser mayor que cero.")
        .max(10000, "Máximo 10.000 unidades por componente."),
    })
  )
  .min(2, "Agrega al menos dos productos diferentes.")
  .max(100, "Máximo 100 componentes.")
  .superRefine((items, context) => {
    if (
      new Set(items.map((item) => item.productId)).size !==
      items.length
    ) {
      context.addIssue({
        code: "custom",
        message: "No repitas componentes.",
      });
    }
  });

export const comboResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    product: productDetailSchema.extend({
      isCombo: z.literal(true),
      components: z.array(
        z.object({
          productId: productIdSchema,
          productName: z.string(),
          quantity: z.number().finite().positive(),
        })
      ),
    }),
  }),
});

export type ProductEditInput = z.output<typeof productEditSchema>;

export type ComboComponent = z.infer<typeof componentsSchema>[number];

export type CatalogDetail = z.infer<typeof productDetailSchema> & {
  components?: {
    productId: string;
    productName: string;
    quantity: number;
  }[];
};

export type ProductActionKind =
  | "detail"
  | "edit"
  | "image"
  | "remove-image"
  | "status"
  | "inventory";

export type ProductMutation =
  | {
      kind: "create";
      isCombo: boolean;
      input: ProductEditInput;
      components?: ComboComponent[];
      file?: File;
    }
  | {
      kind: "edit";
      id: string;
      isCombo: boolean;
      input: Partial<ProductEditInput>;
      components?: ComboComponent[];
    }
  | {
      kind: "status";
      id: string;
      isActive: boolean;
    }
  | {
      kind: "image";
      id: string;
      file: File;
    }
  | {
      kind: "remove-image";
      id: string;
    };
```

### [ProductForm.tsx](../src/features/products/components/ProductForm.tsx)

Archivo modificado; el parche conserva el resto de su código.

```tsx
import { useRef, useState } from "react";
import { Boxes, Save } from "lucide-react";
import { InventoryTrackingBadge } from "./ProductBadges";
import { Alert } from "../../../components/feedback/Alert";
import { TextField } from "../../../components/forms/TextField";
import { TextAreaField } from "../../../components/forms/TextAreaField";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/http/client";
import type { Category } from "../../categories/schemas/category.schema";
import type { PreparationArea } from "../../preparation-areas/schemas/preparation-area.schema";
import type { Product } from "../schemas/product.schema";
import {
  componentsSchema,
  productEditSchema,
} from "../schemas/product-action.schema";
import type {
  CatalogDetail,
  ComboComponent,
  ProductEditInput,
  ProductMutation,
} from "../schemas/product-action.schema";
import { ComboComponentsEditor } from "./ComboComponentsEditor";
import { ProductImageField } from "./ProductImageField";
import { formatProductPrice } from "../utils/product-list";

interface ProductFormProps {
  original?: CatalogDetail;
  isCombo?: boolean;
  products: readonly Product[];
  categories: readonly Category[];
  areas: readonly PreparationArea[];
  busy: boolean;
  summary?: Product;
  onInventory?: () => void;
  onSave: (action: ProductMutation) => Promise<void>;
  onCancel: () => void;
}

export function ProductForm({
  original,
  summary,
  isCombo: originalIsCombo = false,
  products,
  categories,
  areas,
  busy,
  onSave,
  onCancel,
  onInventory,
}: ProductFormProps) {
  const [isCombo, setIsCombo] = useState(originalIsCombo);

  const [draft, setDraft] = useState({
    name: original?.name ?? "",
    sku: original?.sku ?? "",
    description: original?.description ?? "",
    currentPrice: original?.currentPrice ?? "",
    categoryId: original?.categoryId ?? "",
    preparationAreaId: original?.preparationAreaId ?? "",
    fulfillmentMode: original?.fulfillmentMode ?? "",
  });

  const [components, setComponents] = useState<ComboComponent[]>(
    original?.components?.map(({ productId, quantity }) => ({
      productId,
      quantity,
    })) ?? []
  );

  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saving = useRef(false);

  const parsed = productEditSchema.safeParse(draft);

  const compositionValid =
    !isCombo ||
    (componentsSchema.safeParse(components).success &&
      components.every(
        (component) =>
          component.productId !== original?.id &&
          products.some(
            (product) =>
              product.id === component.productId &&
              product.isActive &&
              product.canBeComboComponent
          )
      ));

  const setupValid =
    categories.some(
      (category) =>
        category.id === draft.categoryId &&
        (category.isActive || original?.categoryId === category.id)
    ) &&
    areas.some(
      (area) =>
        area.id === draft.preparationAreaId &&
        (area.isActive || original?.preparationAreaId === area.id)
    );

  const valid = parsed.success && compositionValid && setupValid;

  function change(key: keyof typeof draft, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setMessage("");
  }

  async function submit() {
    if (busy || saving.current || !valid || !parsed.success) {
      return;
    }

    saving.current = true;
    setMessage("");
    setErrors({});

    try {
      if (!original) {
        await onSave({
          kind: "create",
          isCombo,
          input: parsed.data,
          ...(isCombo ? { components } : {}),
          ...(file ? { file } : {}),
        });
      } else {
        const input = Object.fromEntries(
          Object.entries(parsed.data).filter(([key, value]) => {
            const previous = original[key as keyof ProductEditInput];

            return key === "currentPrice"
              ? formatProductPrice(String(value)) !==
                  formatProductPrice(String(previous))
              : value !== previous;
          })
        ) as Partial<ProductEditInput>;

        const normalized = (items: ComboComponent[]) =>
          JSON.stringify(
            [...items].sort((first, second) =>
              first.productId.localeCompare(second.productId)
            )
          );

        const previous =
          original.components?.map(({ productId, quantity }) => ({
            productId,
            quantity,
          })) ?? [];

        const compositionChanged =
          isCombo && normalized(previous) !== normalized(components);

        if (!Object.keys(input).length && !compositionChanged) {
          onCancel();
          return;
        }

        await onSave({
          kind: "edit",
          id: original.id,
          isCombo,
          input,
          ...(compositionChanged ? { components } : {}),
        });
      }
    } catch (cause) {
      if (cause instanceof ApiError) {
        setErrors(
          Object.fromEntries(
            cause.errors.map((error) => [error.field, error.message])
          )
        );

        if (cause.code === "PRODUCT_SKU_CONFLICT") {
          setErrors((previous) => ({
            ...previous,
            sku: cause.message,
          }));
        }
      }

      setMessage(
        cause instanceof Error
          ? cause.message
          : "No pudimos guardar el producto."
      );
    } finally {
      saving.current = false;
    }
  }

  return (
    <form
      className="product-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="product-modal-section">
        <section className="product-form-section">
          <h3>Información comercial</h3>

          <TextField
            label="Nombre del producto"
            placeholder="Ej. Combo desayuno"
            required
            maxLength={150}
            value={draft.name}
            disabled={busy}
            error={errors.name}
            onChange={(event) => change("name", event.target.value)}
          />

          <div className="product-form-grid">
            <TextField
              label="Código SKU (opcional)"
              placeholder="Ej. DESAYUNO-01"
              maxLength={50}
              value={draft.sku}
              disabled={busy}
              error={errors.sku}
              onChange={(event) => change("sku", event.target.value)}
            />

            <TextField
              label="Precio de venta"
              placeholder="Ej. 15000.00"
              inputMode="decimal"
              required
              value={draft.currentPrice}
              disabled={busy}
              error={errors.currentPrice}
              onChange={(event) =>
                change("currentPrice", event.target.value)
              }
            />
          </div>

          <TextAreaField
            label="Descripción (opcional)"
            placeholder="Describe el producto o la oferta"
            rows={3}
            value={draft.description}
            maxLength={500}
            disabled={busy}
            error={errors.description}
            onChange={(event) =>
              change("description", event.target.value)
            }
          />
        </section>

        <section className="product-form-section">
          <h3>Clasificación y atención</h3>

          <div className="product-form-grid">
            <SelectField
              label="Categoría"
              value={draft.categoryId}
              required
              disabled={busy}
              error={errors.categoryId}
              onValueChange={(value) => change("categoryId", value)}
              options={categories
                .filter(
                  (category) =>
                    category.isActive ||
                    category.id === original?.categoryId
                )
                .map((category) => ({
                  value: category.id,
                  label:
                    category.name +
                    (category.isActive ? "" : " · Inactiva"),
                  disabled: !category.isActive,
                }))}
            />

            <SelectField
              label="Área de preparación"
              value={draft.preparationAreaId}
              required
              disabled={busy}
              error={errors.preparationAreaId}
              onValueChange={(value) =>
                change("preparationAreaId", value)
              }
              options={areas
                .filter(
                  (area) =>
                    area.isActive ||
                    area.id === original?.preparationAreaId
                )
                .map((area) => ({
                  value: area.id,
                  label:
                    area.name + (area.isActive ? "" : " · Inactiva"),
                  disabled: !area.isActive,
                }))}
            />

            {!original ? (
              <SelectField
                label="Tipo de producto"
                value={isCombo ? "combo" : "normal"}
                onValueChange={(value) =>
                  setIsCombo(value === "combo")
                }
                disabled={busy}
                options={[
                  { value: "normal", label: "Producto normal" },
                  { value: "combo", label: "Producto combo" },
                ]}
              />
            ) : (
              <div className="product-readonly-field">
                <span>Tipo de producto</span>
                <p>{isCombo ? "Combo" : "Normal"}</p>
              </div>
            )}

            <SelectField
              label="Forma de cumplimiento"
              value={draft.fulfillmentMode}
              required
              disabled={busy}
              error={errors.fulfillmentMode}
              onValueChange={(value) =>
                change("fulfillmentMode", value)
              }
              options={[
                {
                  value: "PREPARE_TO_ORDER",
                  label: "Preparar después de recibir el pedido",
                },
                {
                  value: "READY_TO_SERVE",
                  label: "Ya está listo para entregar",
                },
              ]}
            />
          </div>

          <p className="product-modal-help">
            La forma de cumplimiento define la preparación y entrega
            del producto dentro de una orden.
          </p>
        </section>

        {isCombo && (
          <section className="product-form-section">
            <ComboComponentsEditor
              products={products}
              value={components}
              ownId={original?.id}
              onChange={setComponents}
              disabled={busy}
            />

            {!compositionValid && (
              <p className="text-xs text-danger">
                Agrega componentes existentes con cantidades mayores
                que cero. El combo no puede incluirse a sí mismo.
              </p>
            )}
          </section>
        )}

        {!original && (
          <section className="product-form-section">
            <ProductImageField
              file={file}
              name={draft.name}
              disabled={busy}
              onChange={setFile}
            />
          </section>
        )}

        <div className="product-inventory-note">
          <div>
            {summary ? (
              <div className="product-inventory-summary">
                <Boxes size={16} aria-hidden="true" />
                <InventoryTrackingBadge product={summary} />
              </div>
            ) : (
              <p>
                El inventario es opcional y se configura después de
                crear el producto.
              </p>
            )}

            {summary && (
              <p className="product-modal-help">
                Su configuración se administra desde Inventario.
              </p>
            )}
          </div>

          {onInventory && (
            <button
              type="button"
              className="product-modal-link"
              disabled={busy}
              onClick={onInventory}
            >
              Ir a Inventario
            </button>
          )}
        </div>

        <div className="product-form-feedback">
          {message && (
            <Alert>
              <p>{message}</p>

              {Object.entries(errors)
                .filter(([key]) => key.startsWith("components"))
                .map(([key, text]) => (
                  <p key={key}>{text}</p>
                ))}
            </Alert>
          )}

          {!categories.some((category) => category.isActive) && (
            <Alert>
              Necesitas una categoría activa para crear productos.
            </Alert>
          )}

          {!areas.some((area) => area.isActive) && (
            <Alert>
              Necesitas un área de preparación activa para crear
              productos.
            </Alert>
          )}
        </div>
      </div>

      <footer className="product-modal-footer">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>

        <Button
          size="sm"
          type="submit"
          loading={busy}
          loadingText="Guardando…"
          disabled={!valid || busy}
        >
          <Save size={16} aria-hidden="true" />
          {original ? "Guardar cambios" : "Crear producto"}
        </Button>
      </footer>
    </form>
  );
}
```

### [ComboComponentsEditor.tsx](../src/features/products/components/ComboComponentsEditor.tsx)

Archivo modificado; el parche conserva el resto de su código.

```tsx
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { Button } from "../../../components/ui/Button";
import type { Product } from "../schemas/product.schema";
import type { ComboComponent } from "../schemas/product-action.schema";
import { formatProductPrice } from "../utils/product-list";

interface ComboComponentsEditorProps {
  products: readonly Product[];
  value: ComboComponent[];
  disabled: boolean;
  ownId?: string;
  onChange: (value: ComboComponent[]) => void;
}

export function ComboComponentsEditor({
  products,
  value,
  disabled,
  ownId,
  onChange,
}: ComboComponentsEditorProps) {
  const [selected, setSelected] = useState("");

  const available = products.filter(
    (product) =>
      product.id !== ownId &&
      product.isActive &&
      product.canBeComboComponent
  );

  const chosen = available.find((product) => product.id === selected);

  function addComponent() {
    if (disabled || !chosen) return;

    const previous = value.find(
      (item) => item.productId === chosen.id
    );

    if (previous ? previous.quantity >= 10000 : value.length >= 100) return;

    onChange(
      previous
        ? value.map((item) =>
            item.productId === chosen.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        : [...value, { productId: chosen.id, quantity: 1 }]
    );
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-outline/60 p-3"
      aria-label="Componentes del combo"
    >
      <p className="text-sm font-semibold text-heading">
        Componentes del combo
      </p>

      <SelectField
        label="Producto"
        value={selected}
        disabled={disabled}
        onValueChange={setSelected}
        options={available.map((product) => ({
          value: product.id,
          label:
            product.name + (product.isActive ? "" : " · Inactivo"),
        }))}
      />

      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || !chosen}
        onClick={addComponent}
      >
        <Plus size={16} />
        Agregar componente
      </Button>

      {!available.length && (
        <p className="text-xs text-muted">
          No hay productos elegibles. Configura su inventario y activa
          el descuento automático antes de agregarlos al combo.
        </p>
      )}

      {!value.length && (
        <p className="text-xs text-muted">
          Selecciona al menos dos productos diferentes con inventario activo.
        </p>
      )}

      {value.map((item) => {
        const product = products.find(
          (candidate) => candidate.id === item.productId
        );

        return (
          <div
            key={item.productId}
            className="space-y-2 border-t border-outline/60 pt-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-heading">
                  {product?.name ??
                    "Producto no disponible en el catálogo"}
                </p>

                {(!product?.isActive || !product?.canBeComboComponent) && (
                  <p className="text-xs text-red-500" role="alert">
                    Este componente ya no tiene inventario utilizable.
                    Corrígelo o retíralo antes de guardar.
                  </p>
                )}

                {product && (
                  <p className="text-xs text-muted">
                    {formatProductPrice(product.currentPrice)} por
                    unidad
                  </p>
                )}
              </div>

              <Button
                size="sm"
                variant="danger"
                disabled={disabled}
                aria-label={`Quitar ${
                  product?.name ?? item.productId
                }`}
                onClick={() =>
                  onChange(
                    value.filter(
                      (candidate) =>
                        candidate.productId !== item.productId
                    )
                  )
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>

            <TextField
              label="Cantidad"
              type="number"
              min="1"
              max="10000"
              step="1"
              value={item.quantity || ""}
              disabled={disabled}
              required
              error={
                Number.isInteger(item.quantity) &&
                item.quantity >= 1 &&
                item.quantity <= 10000
                  ? undefined
                  : "Usa un entero entre 1 y 10.000."
              }
              onChange={(event) =>
                onChange(
                  value.map((candidate) =>
                    candidate.productId === item.productId
                      ? {
                          ...candidate,
                          quantity: Number(event.target.value),
                        }
                      : candidate
                  )
                )
              }
            />
          </div>
        );
      })}
    </section>
  );
}
```

### [product-inventory.ts](../src/features/products/utils/product-inventory.ts)

Archivo modificado; el parche conserva el resto de su código.

```ts
import { getNavigation } from "../../../app/navigation";

export function productInventoryPath(
  productId: string,
  hasInventory: boolean,
  isCombo: boolean
): string | null {
  const route = getNavigation(["ADMIN"]).find(
    (item) => item.id === "inventory"
  );

  if (!route || route.status !== "ready") {
    return null;
  }

  const params = new URLSearchParams({
    productId,
    intent: isCombo || hasInventory ? "manage" : "configure",
  });

  const separator = route.to.includes("?") ? "&" : "?";

  return `${route.to}${separator}${params.toString()}`;
}
```

### [ProductsPage.tsx](../src/features/products/pages/ProductsPage.tsx)

Archivo modificado; el parche conserva el resto de su código.

```tsx
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { useAppShell } from "../../../app/layout/shell-context";
import type { AuthSession } from "../../auth/types/auth.types";
import type { Product } from "../schemas/product.schema";
import type {
  ProductActionKind,
  ProductMutation,
} from "../schemas/product-action.schema";
import { ProductList } from "../components/ProductList";
import { ProductForm } from "../components/ProductForm";
import { ProductEditor } from "../components/ProductEditor";
import { ProductImageForm } from "../components/ProductImageForm";
import { ProductStatusConfirmDialog } from "../components/ProductStatusConfirmDialog";
import { productInventoryPath } from "../utils/product-inventory";
import { useProducts } from "../hooks/useProducts";
import { useInventoryRealtime } from "../../inventory/hooks/useInventoryRealtime";

type Editor =
  | { kind: "create" }
  | {
      kind: Exclude<ProductActionKind, "inventory">;
      id: string;
    };

export function ProductsPage() {
  const { session } = useAppShell();

  if (!session.authorization.roles.includes("ADMIN")) {
    return <Alert>No tienes acceso a Productos.</Alert>;
  }

  return (
    <ProductsContent
      key={`${session.business.id}:${session.membership.id}:${session.accessToken}`}
      session={session}
    />
  );
}

function ProductsContent({ session }: { session: AuthSession }) {
  const resource = useProducts(session);
  useInventoryRealtime(session, resource.retry);
  const navigate = useNavigate();

  const [editor, setEditor] = useState<Editor | null>(null);
  const [revision, setRevision] = useState(0);

  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);

  const alive = useRef(false);
  const modalId = useId();

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!notice || notice.error) return;

    const timer = window.setTimeout(() => setNotice(null), 7000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  async function save(action: ProductMutation) {
    const warning = await resource.mutate(action);

    if (!alive.current) return;

    setRevision((value) => value + 1);

    setEditor(
      action.kind === "create" || action.kind === "edit"
        ? null
        : { kind: "detail", id: action.id }
    );

    setNotice({
      error: !!warning,
      message:
        warning ??
        (action.kind === "create"
          ? "Producto creado. El control de inventario es opcional y se configura desde Inventario."
          : "Cambios guardados."),
    });
  }

  function onAction(kind: ProductActionKind, product: Product) {
    if (resource.busy) return;

    setNotice(null);

    if (kind === "inventory") {
      setEditor(null);

      const path = productInventoryPath(
        product.id,
        product.hasInventory,
        product.isCombo
      );

      if (path) {
        navigate(path);
      } else {
        setNotice({
          error: false,
          message:
            "Inventario todavía no está disponible. La configuración se realizará en ese módulo.",
        });
      }

      return;
    }

    setEditor({ kind, id: product.id });
  }

  const product =
    editor && editor.kind !== "create"
      ? resource.data?.products.find(
          (candidate) => candidate.id === editor.id
        )
      : undefined;

  const title = !editor
    ? ""
    : editor.kind === "create"
      ? "Nuevo producto"
      : editor.kind === "detail"
        ? "Detalle del producto"
        : editor.kind === "edit"
          ? "Editar producto"
          : editor.kind === "image"
            ? "Imagen del producto"
            : editor.kind === "remove-image"
              ? "Retirar imagen"
              : product?.isActive
                ? "Desactivar producto"
                : "Activar producto";

  const modalSize =
    editor?.kind === "create" || editor?.kind === "edit"
      ? "form"
      : editor?.kind === "detail"
        ? "detail"
        : "small";

  const modalDescription =
    editor?.kind === "create"
      ? "Define la información comercial y cómo se atiende el producto."
      : editor?.kind === "edit"
        ? "Datos comerciales, clasificación y forma de atención."
        : editor?.kind === "detail"
          ? "Información comercial y atención del producto."
          : (product?.name ?? "");

  return (
    <div className="products-page">
      {resource.loading && (
        <LoadingState message="Cargando productos…" />
      )}

      {resource.error && (
        <Alert>
          <p>{resource.error}</p>

          <Button
            size="sm"
            variant="secondary"
            disabled={resource.busy}
            onClick={resource.retry}
          >
            Reintentar consulta
          </Button>
        </Alert>
      )}

      {resource.data && (
        <ProductList
          products={resource.data.products}
          categories={resource.data.categories}
          disabled={resource.busy || !!editor}
          onAction={onAction}
          onCreate={() => {
            setNotice(null);
            setEditor({ kind: "create" });
          }}
        />
      )}

      {notice && !editor && (
        <div className="fixed inset-x-4 bottom-24 z-40 sm:bottom-6 sm:left-auto sm:w-96">
          <Alert variant={notice.error ? "error" : "success"}>
            {notice.message}
          </Alert>
        </div>
      )}

      {editor && resource.data && (
        <BottomSheet
          id={modalId}
          open
          variant="modal"
          title={title}
          busy={resource.busy}
          className={`products-page product-modal product-modal--${modalSize}`}
          onClose={() => setEditor(null)}
        >
          <p className="product-modal-description">
            {modalDescription}
          </p>

          <div className="product-modal-body">
            {notice && (
              <div className="product-modal-notice">
                <Alert variant={notice.error ? "error" : "success"}>
                  {notice.message}
                </Alert>
              </div>
            )}

            {editor.kind === "create" ? (
              <ProductForm
                products={resource.data.products}
                categories={resource.data.categories}
                areas={resource.data.areas}
                busy={resource.busy}
                onSave={save}
                onCancel={() => setEditor(null)}
              />
            ) : !product ? (
              <div className="product-modal-section">
                <Alert>
                  Este producto ya no aparece en el listado. Actualiza
                  la consulta.
                </Alert>
              </div>
            ) : editor.kind === "image" ? (
              <ProductImageForm
                key={product.id}
                product={product}
                busy={resource.busy}
                onSave={save}
                onCancel={() => setEditor(null)}
              />
            ) : editor.kind === "status" ||
              editor.kind === "remove-image" ? (
              <ProductStatusConfirmDialog
                key={`${product.id}:${editor.kind}`}
                product={product}
                kind={editor.kind}
                busy={resource.busy}
                onSave={save}
                onCancel={() => setEditor(null)}
              />
            ) : (
              <ProductEditor
                key={`${product.id}:${editor.kind}:${revision}`}
                product={product}
                editing={editor.kind === "edit"}
                token={session.accessToken}
                products={resource.data.products}
                categories={resource.data.categories}
                areas={resource.data.areas}
                busy={resource.busy}
                onSave={save}
                onCancel={() => setEditor(null)}
                onAction={onAction}
              />
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
```

### [ProductActions.tsx](../src/features/products/components/ProductActions.tsx)

Archivo modificado; el parche conserva el resto de su código.

```tsx
import {
  Boxes,
  Eye,
  ImagePlus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import type { Product } from "../schemas/product.schema";
import type { ProductActionKind } from "../schemas/product-action.schema";

interface ProductActionsProps {
  product: Product;
  disabled?: boolean;
  onAction: (kind: ProductActionKind, product: Product) => void;
}

export function ProductActions({
  product,
  disabled,
  onAction,
}: ProductActionsProps) {
  const actions = [
    {
      id: "detail",
      label: "Ver detalle",
      icon: <Eye size={16} />,
      onSelect: () => onAction("detail", product),
    },
    {
      id: "edit",
      label: "Editar",
      icon: <Pencil size={16} />,
      onSelect: () => onAction("edit", product),
    },
    {
      id: "image",
      label: "Cambiar imagen",
      icon: <ImagePlus size={16} />,
      onSelect: () => onAction("image", product),
    },
    ...(product.imageUrl
      ? [
          {
            id: "remove-image",
            label: "Retirar imagen",
            icon: <Trash2 size={16} />,
            danger: true,
            onSelect: () => onAction("remove-image", product),
          },
        ]
      : []),
    {
      id: "inventory",
      label: product.isCombo
        ? "Ver consumo del combo"
        : product.hasInventory
          ? "Gestionar en Inventario"
          : "Configurar en Inventario",
      icon: <Boxes size={16} />,
      onSelect: () => onAction("inventory", product),
    },
    {
      id: "status",
      label: product.isActive ? "Desactivar" : "Activar",
      icon: product.isActive ? (
        <ToggleRight size={18} />
      ) : (
        <ToggleLeft size={18} />
      ),
      danger: product.isActive,
      separatorBefore: true,
      onSelect: () => onAction("status", product),
    },
  ];

  return (
    <ActionMenu
      label={`Acciones de ${product.name}`}
      appearance="compact"
      disabled={disabled}
      actions={actions}
    />
  );
}
```

### [InventoryPage.tsx](../src/features/inventory/pages/InventoryPage.tsx)

Archivo modificado; el parche conserva el resto de su código.

```tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Boxes,
  ChevronDown,
  CircleX,
  Factory,
  FilterX,
  History,
  Link2,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import { InventoryList } from "../components/InventoryList";
import type { InventoryAction } from "../components/InventoryActions";
import { useInventory } from "../hooks/useInventory";
import { useInventoryRealtime } from "../hooks/useInventoryRealtime";
import type { InventoryItem } from "../schemas/inventory.schema";
import { InventoryDialog } from "../components/InventoryDialog";
import type { InventoryDialogAction } from "../components/InventoryDialog";
import { InventoryCreateDialog } from "../components/InventoryCreateDialog";
import { InventoryMovements } from "../components/InventoryMovements";
import { InventoryConsumption } from "../components/InventoryConsumption";
import { InventoryProduction } from "../components/InventoryProduction";
import { ProductInventorySetupDialog } from "../components/ProductInventorySetupDialog";
import {
  dayKey,
  formatQuantity,
  itemTypeLabels,
  searchKey,
  unitLabels,
  validTimeZone,
} from "../utils/inventory-format";

import {
  InventorySkeleton,
  InventoryLoadError,
  InventoryEmptyState,
} from "../components/InventoryStates";

export function InventoryPage() {
  const { session } = useAppShell();

  return (
    <InventoryScreen
      key={session.business.id + ":" + session.membership.id}
    />
  );
}

function InventoryScreen() {
  const { session, settings } = useAppShell();
  const resource = useInventory(session);
  const [params, setParams] = useSearchParams();

  const [creating, setCreating] = useState(false);
  const [revision, setRevision] = useState(0);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [stock, setStock] = useState("ALL");
  const [activity, setActivity] = useState("ALL");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<InventoryDialogAction | null>(
    null
  );
  const [clock, setClock] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(
      () => setClock(Date.now()),
      60_000
    );

    return () => window.clearInterval(timer);
  }, []);

  const items = resource.items.data;

  const active = items?.filter((item) => item.isActive) ?? [];

  const critical = active.filter(
    (item) => item.stockStatus !== "AVAILABLE"
  );

  const exhausted = active.filter(
    (item) => item.stockStatus === "OUT_OF_STOCK"
  );

  const low = active.filter(
    (item) => item.stockStatus === "LOW_STOCK"
  );

  const query = searchKey(search);

  const filtered = (items ?? []).filter((item) => {
    const matchesStock =
      stock === "ALL" ||
      (stock === "ATTENTION"
        ? item.isActive && item.stockStatus !== "AVAILABLE"
        : item.stockStatus === stock);

    return (
      searchKey(item.name + " " + (item.sku ?? "")).includes(query) &&
      (type === "ALL" || item.itemType === type) &&
      matchesStock &&
      (activity === "ALL" ||
        item.isActive === (activity === "ACTIVE"))
    );
  });

  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize))
  );

  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const filteredByUser =
    !!search ||
    type !== "ALL" ||
    stock !== "ALL" ||
    activity !== "ALL";

  const zone = validTimeZone(settings.data?.timezone);
  const today = zone ? dayKey(clock, zone) : null;

  const todayCount =
    zone && today && resource.movements.data
      ? resource.movements.data.filter(
          (movement) => dayKey(movement.createdAt, zone) === today
        ).length
      : null;

  const updated = resource.items.updatedAt;

  const updatedLabel =
    updated && zone
      ? new Intl.DateTimeFormat("es-CO", {
          timeZone: zone,
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        }).format(updated)
      : null;

  // Compatible con la navegación actual desde Productos
  // y con el parámetro propuesto por el backend.
  const productId =
    params.get("setupProductId") ?? params.get("productId");

  const configureProductId =
    productId &&
    (params.get("intent") === "configure" ||
      params.has("setupProductId"))
      ? productId
      : "";

  function finishConfiguration() {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        next.delete("intent");
        next.delete("setupProductId");
        next.set("tab", "consumption");

        if (productId) {
          next.set("productId", productId);
        }

        return next;
      },
      { replace: true }
    );
  }

  function clearFilters() {
    setSearch("");
    setType("ALL");
    setStock("ALL");
    setActivity("ALL");
    setPage(1);
  }

  function showCritical() {
    setSearch("");
    setType("ALL");
    setStock("ATTENTION");
    setActivity("ACTIVE");
    setPage(1);
  }

  const tab =
    params.get("tab") === "production"
      ? "production"
      : params.get("tab") === "movements"
        ? "movements"
        : params.get("tab") === "consumption" || productId
          ? "consumption"
          : "stock";

  function openTab(
    next: "stock" | "movements" | "consumption" | "production",
    itemId?: string
  ) {
    const nextParams = new URLSearchParams(params);

    [
      "tab",
      "itemId",
      "productId",
      "setupProductId",
      "intent",
    ].forEach((key) => nextParams.delete(key));

    if (next !== "stock") {
      nextParams.set("tab", next);
    }

    if (itemId) {
      nextParams.set("itemId", itemId);
    }

    setParams(nextParams);
  }

  function refreshInventory() {
    resource.refresh();
    setRevision((value) => value + 1);
  }

  useInventoryRealtime(session, refreshInventory);

  function onAction(action: InventoryAction, item: InventoryItem) {
    if (
      action === "detail" ||
      action === "edit" ||
      action === "movement" ||
      action === "status"
    ) {
      setDialog({
        kind: action,
        id: item.id,
      });

      return;
    }

    openTab(
      action === "history" ? "movements" : "consumption",
      item.id
    );
  }

  return (
    <section
      className="inventory-page"
      aria-label="Gestión de inventario"
    >
      <nav
        className="inventory-tabs"
        aria-label="Secciones de inventario"
      >
        <button
          type="button"
          aria-current={tab === "stock" ? "page" : undefined}
          onClick={() => openTab("stock")}
        >
          <Boxes size={16} />
          Existencias
        </button>

        <button
          type="button"
          aria-current={tab === "movements" ? "page" : undefined}
          onClick={() => openTab("movements")}
        >
          <History size={16} />
          Movimientos
        </button>

        <button
          type="button"
          aria-current={tab === "consumption" ? "page" : undefined}
          onClick={() => openTab("consumption")}
        >
          <Link2 size={16} />
          Consumo por producto
        </button>

        <button
          type="button"
          aria-current={tab === "production" ? "page" : undefined}
          onClick={() => openTab("production")}
        >
          <Factory size={16} />
          Producción
        </button>
      </nav>

      {notice && tab === "consumption" && (
        <p className="inventory-message" role="status">
          {notice}
        </p>
      )}

      {tab === "production" ? (
        <InventoryProduction
          revision={revision}
          onChanged={refreshInventory}
        />
      ) : tab === "movements" ? (
        <InventoryMovements
          key={"movements:" + (params.get("itemId") ?? "")}
          items={items ?? []}
          initialItemId={params.get("itemId") ?? ""}
          revision={revision}
          onRegister={() =>
            setDialog({
              kind: "movement",
            })
          }
        />
      ) : tab === "consumption" ? (
        <InventoryConsumption
          key={
            "consumption:" +
            (params.get("itemId") ?? "") +
            ":" +
            (productId ?? "") +
            ":" +
            (configureProductId ? "configure" : "list")
          }
          items={items ?? []}
          itemsReady={
            items !== null &&
            !resource.items.pending &&
            !resource.items.error
          }
          itemsError={resource.items.error}
          initialItemId={params.get("itemId") ?? ""}
          initialProductId={productId ?? ""}
          revision={revision}
          onItem={(id) =>
            setDialog({
              kind: "detail",
              id,
            })
          }
          onChanged={refreshInventory}
        />
      ) : resource.items.loading ? (
        <InventorySkeleton />
      ) : items === null ? (
        <InventoryLoadError
          message={resource.items.error}
          status={resource.items.errorStatus}
          busy={resource.items.pending}
          onRetry={resource.refresh}
        />
      ) : (
        <>
          <header className="inventory-heading">
            <div>
              <h2>Inventario</h2>

              <p>
                {items
                  ? active.length + " artículos activos"
                  : "Consulta de existencias"}

                {updatedLabel && " · Actualizado " + updatedLabel}

                {resource.items.refreshing && " · Actualizando…"}
              </p>
            </div>

            <div className="inventory-buttons">
              <Button
                variant="secondary"
                size="sm"
                onClick={resource.refresh}
                loading={resource.pending}
                loadingText="Actualizando…"
              >
                <RefreshCw size={16} />
                Actualizar
              </Button>

              <Button size="sm" onClick={() => setCreating(true)}>
                <PackagePlus size={16} />
                Nuevo artículo
              </Button>
            </div>
          </header>

          {notice && (
            <div className="inventory-message" role="status">
              <span>{notice}</span>

              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Cerrar aviso"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {resource.items.error && (
            <div
              className="inventory-message inventory-error"
              role="alert"
            >
              <span>
                {resource.items.error}

                {items &&
                  " Se conserva la última consulta; los datos pueden estar desactualizados."}
              </span>

              <Button
                variant="secondary"
                size="sm"
                onClick={resource.refresh}
                disabled={resource.pending}
              >
                Reintentar
              </Button>
            </div>
          )}

          <div className="inventory-metrics">
            {[
              {
                label: "Artículos activos",
                value: items ? active.length : null,
                Icon: Boxes,
                tone: "normal",
              },
              {
                label: "Agotados",
                value: items ? exhausted.length : null,
                Icon: CircleX,
                tone: "danger",
              },
              {
                label: "Bajo el mínimo",
                value: items ? low.length : null,
                Icon: TriangleAlert,
                tone: "warning",
              },
              {
                label: "Movimientos hoy",
                value: todayCount,
                Icon: History,
                tone: "normal",
              },
            ].map(({ label, value, Icon, tone }) => (
              <div
                key={label}
                className="inventory-metric"
                data-tone={tone}
              >
                <span className="inventory-metric-icon">
                  <Icon size={21} aria-hidden="true" />
                </span>

                <div>
                  <p>{label}</p>
                  <strong>{value ?? "—"}</strong>
                </div>
              </div>
            ))}
          </div>

          {(resource.movements.error || !zone) && (
            <p className="inventory-muted" role="status">
              {resource.movements.error
                ? "No se actualizó el contador de movimientos: " +
                  resource.movements.error
                : "El contador de hoy requiere la zona horaria del negocio."}
            </p>
          )}

          {critical.length > 0 && (
            <div className="inventory-attention">
              <details>
                <summary>
                  <TriangleAlert size={18} />

                  <span>
                    Hay {critical.length} artículos que requieren
                    atención.
                  </span>

                  <ChevronDown size={16} />
                </summary>

                <ul>
                  {critical.map((item) => (
                    <li key={item.id}>
                      <strong>{item.name}</strong>

                      <span>
                        {formatQuantity(item.currentStock)}{" "}
                        {unitLabels[item.baseUnit]}
                        {" · Mínimo "}
                        {formatQuantity(item.minimumStock)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>

              <div className="inventory-buttons">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={showCritical}
                >
                  Ver artículos críticos
                </Button>

                <Button
                  size="sm"
                  onClick={() =>
                    setDialog({
                      kind: "movement",
                      initialType: "PURCHASE",
                    })
                  }
                >
                  <Plus size={16} />
                  Registrar entrada
                </Button>
              </div>
            </div>
          )}

          <div className="inventory-filters">
            <div className="inventory-search">
              <label htmlFor="inventory-search" className="sr-only">
                Buscar por nombre o SKU
              </label>

              <Search size={16} aria-hidden="true" />

              <input
                id="inventory-search"
                type="search"
                value={search}
                placeholder="Buscar por nombre o SKU"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>

            <SelectField
              label="Tipo de artículo"
              hideLabel
              value={type}
              options={[
                {
                  value: "ALL",
                  label: "Todos los tipos",
                },
                ...Object.entries(itemTypeLabels).map(
                  ([value, label]) => ({ value, label })
                ),
              ]}
              onValueChange={(value) => {
                setType(value);
                setPage(1);
              }}
            />

            <SelectField
              label="Existencias"
              hideLabel
              value={stock}
              options={[
                { value: "ALL", label: "Todo el stock" },
                {
                  value: "ATTENTION",
                  label: "Requieren atención",
                },
                {
                  value: "OUT_OF_STOCK",
                  label: "Agotado",
                },
                {
                  value: "LOW_STOCK",
                  label: "Bajo mínimo",
                },
                {
                  value: "AVAILABLE",
                  label: "Disponible",
                },
              ]}
              onValueChange={(value) => {
                setStock(value);
                setPage(1);
              }}
            />

            <SelectField
              label="Estado del artículo"
              hideLabel
              value={activity}
              options={[
                {
                  value: "ALL",
                  label: "Activos e inactivos",
                },
                {
                  value: "ACTIVE",
                  label: "Solo activos",
                },
                {
                  value: "INACTIVE",
                  label: "Solo inactivos",
                },
              ]}
              onValueChange={(value) => {
                setActivity(value);
                setPage(1);
              }}
            />

            {filteredByUser && (
              <Button
                variant="secondary"
                size="sm"
                onClick={clearFilters}
              >
                <FilterX size={16} />
                Limpiar filtros
              </Button>
            )}
          </div>

          <div aria-busy={resource.items.refreshing}>
            {visible.length > 0 ? (
              <InventoryList items={visible} onAction={onAction} />
            ) : (
              <InventoryEmptyState
                filtered={items.length > 0}
                onClear={clearFilters}
                onCreate={() => setCreating(true)}
              />
            )}
          </div>

          {filtered.length > 10 && (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              totalItems={filtered.length}
              itemLabel="artículos"
              totalLabel={
                filteredByUser
                  ? (items?.length ?? 0) + " artículos en total"
                  : undefined
              }
              controlsId="inventory-results"
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}

          {items && filtered.length <= 10 && (
            <p className="inventory-muted" role="status">
              {filtered.length}{" "}
              {filtered.length === 1 ? "artículo" : "artículos"}
              {filteredByUser && " · " + items.length + " en total"}
            </p>
          )}
        </>
      )}

      {configureProductId && (
        <ProductInventorySetupDialog
          key={session.accessToken + ":" + configureProductId}
          productId={configureProductId}
          onClose={() => {
            finishConfiguration();
            refreshInventory();
          }}
          onResolved={(alreadyConfigured) => {
            finishConfiguration();

            setNotice(
              alreadyConfigured
                ? "El producto ya tenía inventario. Se muestran sus relaciones existentes."
                : "Inventario configurado. El descuento automático por venta está activo."
            );

            refreshInventory();
          }}
        />
      )}

      {creating && (
        <InventoryCreateDialog
          key={session.accessToken}
          onClose={() => {
            setCreating(false);
            refreshInventory();
          }}
          onSaved={() => {
            setCreating(false);
            setNotice("Artículo creado.");
            refreshInventory();
          }}
        />
      )}

      {dialog && (
        <InventoryDialog
          key={
            session.accessToken +
            ":" +
            dialog.kind +
            ":" +
            (dialog.id ?? "general")
          }
          action={dialog}
          onClose={() => setDialog(null)}
          onChanged={(message) => {
            setNotice(message);
            refreshInventory();
          }}
        />
      )}
    </section>
  );
}
```

### [inventory-setup.ts](../src/features/inventory/services/inventory-setup.ts)

Archivo modificado; el parche conserva el resto de su código.

```ts
import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { productDetailSchema } from "../../products/schemas/product.schema";
import { getProductDetail } from "../../products/services/product.service";
import {
  inventoryItemSchema,
  baseUnitSchema,
} from "../schemas/inventory.schema";
import { linkSchema, loadLinks } from "./inventory-workspace";

const quantity = z
  .string()
  .trim()
  .transform((value) => value.replace(",", "."))
  .pipe(
    z
      .string()
      .regex(
        /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/,
        "Usa una cantidad desde cero, con máximo tres decimales."
      )
  );

export const inventorySetupSchema = z.object({
  trackingType: z.enum(["RESALE", "PRODUCTION"]),

  sku: z
    .string()
    .trim()
    .max(50, "SKU: máximo 50 caracteres.")
    .transform((value) => value || null),

  baseUnit: baseUnitSchema,

  openingQuantity: quantity,

  minimumStock: quantity,

  quantityPerProduct: quantity.refine(
    (value) => Number(value) > 0,
    "La cantidad descontada por venta debe ser mayor que cero."
  ),
});

export type InventorySetupDraft = z.input<
  typeof inventorySetupSchema
>;

const responseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    setup: z.object({
      trackingType: z.enum(["RESALE", "PRODUCTION"]),
      product: productDetailSchema,
      inventoryItem: inventoryItemSchema,
      link: linkSchema,
    }),
  }),
});

function authorize(session: AuthSession) {
  if (!session.authorization.roles.includes("ADMIN")) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes acceso al inventario."
    );
  }
}

export async function loadInventorySetup(
  productId: string,
  session: AuthSession,
  signal: AbortSignal
) {
  authorize(session);

  const [product, links] = await Promise.all([
    getProductDetail(productId, false, session.accessToken, signal),
    loadLinks(session, signal),
  ]);

  if (
    product.id !== productId ||
    product.businessId !== session.business.id
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Producto inesperado."
    );
  }

  return {
    product,

    // El backend también considera las relaciones inactivas.
    configured: product.isCombo === true || links.some((link) => link.productId === productId),
  };
}

export async function configureInventory(
  productId: string,
  draft: InventorySetupDraft,
  session: AuthSession,
  signal: AbortSignal
) {
  authorize(session);

  const input = inventorySetupSchema.parse(draft);

  const response = await request(
    "/products/" + encodeURIComponent(productId) + "/inventory-setup",
    responseSchema,
    {
      accessToken: session.accessToken,
      signal,
      method: "POST",
      body: input,
    }
  );

  const setup = response.data.setup;

  if (
    [setup.product, setup.inventoryItem, setup.link].some(
      (value) => value.businessId !== session.business.id
    ) ||
    setup.product.id !== productId ||
    setup.link.productId !== productId ||
    setup.link.inventoryItemId !== setup.inventoryItem.id ||
    setup.trackingType !== input.trackingType
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Configuración inesperada."
    );
  }

  return setup;
}
```

### [ProductInventorySetupDialog.tsx](../src/features/inventory/components/ProductInventorySetupDialog.tsx)

Archivo modificado; el parche conserva el resto de su código.

```tsx
import { useCallback, useId, useRef, useState } from "react";
import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type { ProductDetailData } from "../../products/schemas/product.schema";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import {
  configureInventory,
  inventorySetupSchema,
  loadInventorySetup,
} from "../services/inventory-setup";
import type { InventorySetupDraft } from "../services/inventory-setup";
import { unitLabels } from "../utils/inventory-format";
import { InventoryWriteDialog } from "./InventoryWriteDialog";

export function ProductInventorySetupDialog({
  productId,
  onClose,
  onResolved,
}: {
  productId: string;
  onClose: () => void;
  onResolved: (alreadyConfigured: boolean) => void;
}) {
  const id = useId();

  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadInventorySetup(productId, session, signal),
    [productId]
  );

  const resource = useInventoryQuery(
    "inventory-setup:" + productId,
    loader
  );

  const data = resource.data;

  if (
    !data ||
    resource.pending ||
    resource.error ||
    data.configured ||
    !data.product.isActive
  ) {
    return (
      <BottomSheet
        id={id}
        open
        variant="modal"
        title="Configurar inventario"
        className="inv-dialog inv-centered"
        onClose={onClose}
      >
        <div className="inv-dialog-body">
          {resource.pending ? (
            <p role="status">Cargando configuración…</p>
          ) : resource.error ? (
            <div role="alert">
              <p className="inv-error">{resource.error}</p>

              <Button variant="secondary" onClick={resource.refresh}>
                Reintentar
              </Button>
            </div>
          ) : data?.configured ? (
            <p>
              <strong>{data.product.name}</strong> ya tiene una
              configuración de inventario. Puedes revisar sus
              relaciones, incluidas las inactivas.
            </p>
          ) : (
            <p role="alert">
              El producto no está disponible para configurar.
            </p>
          )}
        </div>

        <footer className="inv-dialog-footer">
          <Button variant="cancel" onClick={onClose}>
            Cancelar
          </Button>

          {!resource.pending &&
            !resource.error &&
            data?.configured && (
              <Button onClick={() => onResolved(true)}>
                Ver configuración existente
              </Button>
            )}
        </footer>
      </BottomSheet>
    );
  }

  return (
    <SetupForm
      key={data.product.id}
      product={data.product}
      onClose={onClose}
      onResolved={onResolved}
    />
  );
}

function SetupForm({
  product,
  onClose,
  onResolved,
}: {
  product: ProductDetailData;
  onClose: () => void;
  onResolved: (alreadyConfigured: boolean) => void;
}) {
  const { session } = useAppShell();

  const [initial] = useState<InventorySetupDraft>(() => ({
    trackingType: "RESALE",
    sku: product.sku ?? "",
    baseUnit: "UNIT",
    openingQuantity: "0",
    minimumStock: "0",
    quantityPerProduct: "1",
  }));

  const [draft, setDraft] = useState(initial);

  const alreadyConfigured = useRef(false);

  const validation = inventorySetupSchema.safeParse(draft);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function update(patch: Partial<InventorySetupDraft>) {
    setDraft((previous) => ({
      ...previous,
      ...patch,
    }));
  }

  return (
    <InventoryWriteDialog
      title="Configurar inventario"
      description="Crea el inventario de este producto y activa el descuento por venta."
      submitLabel="Guardar configuración"
      dirty={dirty}
      valid={validation.success && product.isActive}
      onClose={onClose}
      onSaved={() => onResolved(alreadyConfigured.current)}
      onSave={async (signal) => {
        alreadyConfigured.current = false;

        try {
          await configureInventory(
            product.id,
            draft,
            session,
            signal
          );
        } catch (error) {
          if (
            error instanceof ApiError &&
            [
                "PRODUCT_INVENTORY_ALREADY_CONFIGURED",
                "COMBO_INVENTORY_SETUP_NOT_ALLOWED",
              ].includes(error.code)
          ) {
            // Puede haberse configurado desde otra pestaña
            // después de nuestra consulta inicial.
            alreadyConfigured.current = true;
            return;
          }

          throw error;
        }
      }}
    >
      <p className="inv-note">
        <strong>{product.name}</strong>
      </p>

      <div className="inv-fields">
        <SelectField
          label="Tipo de seguimiento"
          required
          value={draft.trackingType}
          options={[
            {
              value: "RESALE",
              label: "Reventa",
            },
            {
              value: "PRODUCTION",
              label: "Producción",
            },
          ]}
          onValueChange={(value) => {
            if (value === "RESALE" || value === "PRODUCTION") {
              update({ trackingType: value });
            }
          }}
        />

        <label>
          SKU de inventario (opcional)
          <input
            maxLength={50}
            value={draft.sku}
            onChange={(event) => update({ sku: event.target.value })}
          />
        </label>

        <SelectField
          label="Unidad base"
          required
          value={draft.baseUnit}
          options={Object.entries(unitLabels).map(
            ([value, label]) => ({
              value,
              label,
            })
          )}
          onValueChange={(value) => {
            const parsed =
              inventorySetupSchema.shape.baseUnit.safeParse(value);

            if (parsed.success) {
              update({ baseUnit: parsed.data });
            }
          }}
        />

        {(
          [
            ["openingQuantity", "Existencia inicial"],
            ["minimumStock", "Stock mínimo"],
            ["quantityPerProduct", "Cantidad descontada por venta"],
          ] as const
        ).map(([field, label]) => (
          <label key={field}>
            {label} *
            <input
              required
              inputMode="decimal"
              value={draft[field]}
              onChange={(event) =>
                update({
                  [field]: event.target.value,
                })
              }
            />
          </label>
        ))}
      </div>

      <p className="inv-note">
        {draft.trackingType === "RESALE"
          ? "Se creará un artículo de reventa vinculado a este producto."
          : "Se creará un artículo de producto terminado. Después podrás aumentar sus existencias mediante producción."}{" "}
        El descuento por venta estará activo y usará la unidad base
        seleccionada.
      </p>

      {dirty && !validation.success && (
        <p className="inv-error" role="alert">
          {validation.error.issues[0]?.message}
        </p>
      )}
    </InventoryWriteDialog>
  );
}
```
