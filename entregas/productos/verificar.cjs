const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const assert = require("node:assert/strict");
const staged = path.resolve("entregas/productos/archivos");
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    if (file.endsWith(path.join("config", "env.ts"))) return { API_BASE_URL: "http://test.local/api" };
    const replacement = path.join(staged, path.relative(process.cwd(), file));
    const text = fs.readFileSync(fs.existsSync(replacement) ? replacement : file, "utf8");
    const js = ts.transpileModule(text, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    const m = { exports: {} }; cache.set(file, m);
    new Function("require", "module", "exports", js)(name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (!name.startsWith(".")) return require(name);
      const base = path.resolve(path.dirname(file), name);
      const p = [".ts", ".tsx", ""].map(ext => base + ext).find(p =>
        fs.existsSync(path.join(staged, path.relative(process.cwd(), p))) || fs.existsSync(p));
      return load(p);
    }, m, m.exports);
    return m.exports;
  }
  return load;
}
const detail = { id: "25", businessId: "1", categoryId: "2", preparationAreaId: "1",
  fulfillmentMode: "READY_TO_SERVE", sku: null, name: "Agua", description: null,
  imageUrl: null, currentPrice: "5000.00", isActive: true,
  createdAt: "2026-09-24T18:00:00.000Z", updatedAt: "2026-09-24T18:00:00.000Z" };
const product = { ...detail, categoryName: "Bebidas", preparationAreaName: "Barra",
  isCombo: false, hasInventory: true, inventoryTrackingType: "RESALE" };
const input = { categoryId: "2", preparationAreaId: "1", fulfillmentMode: "READY_TO_SERVE",
  sku: null, name: "Agua", description: null, currentPrice: "5000.00" };
const calls = [];
global.fetch = async (url, options) => {
  calls.push({ url, options });
  const pathname = new URL(url).pathname;
  let payload = { status: "success" };
  if (options.method === "GET" && pathname === "/api/products") {
    const second = new URL(url).searchParams.get("page") === "2";
    payload = { status: "success", data: {
      products: [{ ...product, id: second ? "26" : "25" }],
      pagination: { page: second ? 2 : 1, pageSize: 1, total: 2, totalPages: 2 },
    } };
  } else if (options.method === "GET") {
    payload = { status: "success", data: { product: pathname.includes("/combos/")
      ? { ...detail, isCombo: true, components: [{ productId: "26", productName: "Pan", quantity: 2 }] }
      : detail } };
  }
  return new Response(JSON.stringify(payload), { status: options.method === "POST" ? 201 : 200,
    headers: { "Content-Type": "application/json" } });
};
const load = loader({
  "../../categories/services/category.service": { getCategories: async () => [] },
  "../../preparation-areas/services/preparation-area.service": { getPreparationAreas: async () => [] },
});
const service = load("src/features/products/services/product.service.ts");
const schemas = load("src/features/products/schemas/product-action.schema.ts");
const signal = new AbortController().signal;
(async () => {
  const catalog = await service.getProductCatalog("admin-token", signal);
  assert.equal(catalog.products.length, 2);
  assert.ok(calls.some(c => c.url.includes("page=2")));
  await service.saveProduct({ kind: "create", isCombo: false, input }, "admin-token", signal);
  let last = calls.at(-1);
  assert.equal(last.url, "http://test.local/api/products");
  assert.equal(last.options.headers.get("Authorization"), "Bearer admin-token");
  assert.equal(last.options.headers.get("Content-Type"), "application/json");
  assert.deepEqual(JSON.parse(last.options.body), input);
  const image = new File(["image"], "agua.png", { type: "image/png" });
  await service.saveProduct({ kind: "create", isCombo: false, input, file: image }, "admin-token", signal);
  last = calls.at(-1);
  assert.ok(last.options.body instanceof FormData);
  assert.equal(last.options.headers.has("Content-Type"), false);
  assert.equal(last.options.body.get("image").name, "agua.png");
  await service.saveProduct({ kind: "create", isCombo: true, input,
    components: [{ productId: "25", quantity: 2 }] }, "admin-token", signal);
  last = calls.at(-1);
  assert.equal(last.url, "http://test.local/api/products/combos");
  assert.deepEqual(JSON.parse(last.options.body.get("components")), [{ productId: "25", quantity: 2 }]);
  assert.equal(last.options.body.has("isCombo"), false);
  await service.saveProduct({ kind: "edit", id: "25", isCombo: true,
    input: { currentPrice: "6000.00" }, components: [{ productId: "26", quantity: 3 }] }, "admin-token", signal);
  last = calls.at(-1);
  assert.equal(last.options.method, "PATCH");
  assert.deepEqual(JSON.parse(last.options.body), { currentPrice: "6000.00", components: [{ productId: "26", quantity: 3 }] });
  await service.saveProduct({ kind: "edit", id: "25", isCombo: false, input: { name: "Agua nueva" } }, "admin-token", signal);
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { name: "Agua nueva" });
  await service.saveProduct({ kind: "image", id: "25", file: image }, "admin-token", signal);
  assert.equal(calls.at(-1).options.method, "PUT");
  await service.saveProduct({ kind: "remove-image", id: "25" }, "admin-token", signal);
  assert.equal(calls.at(-1).url, "http://test.local/api/products/25/image");
  assert.equal(calls.at(-1).options.method, "DELETE");
  await service.saveProduct({ kind: "status", id: "25", isActive: false }, "admin-token", signal);
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { isActive: false });
  const combo = await service.getProductDetail("25", true, "admin-token", signal);
  assert.equal(combo.components[0].productName, "Pan");
  const normal = await service.getProductDetail("25", false, "admin-token", signal);
  assert.equal(normal.name, "Agua");
  assert.ok(!calls.some(c => c.url.includes("inventory")));
  assert.equal(schemas.componentsSchema.safeParse([{ productId: "25", quantity: 0 }]).success, false);
  assert.equal(schemas.componentsSchema.safeParse([{ productId: "25", quantity: 1 }, { productId: "25", quantity: 2 }]).success, false);
  const before = calls.length;
  await assert.rejects(service.saveProduct({ kind: "image", id: "25",
    file: new File(["bad"], "bad.svg", { type: "image/svg+xml" }) }, "admin-token", signal));
  assert.equal(calls.length, before);
  assert.equal(schemas.productEditSchema.safeParse({ ...input, fulfillmentMode: "PRODUCTION" }).success, false);
  const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
  const { ProductForm } = load("src/features/products/components/ProductForm.tsx");
  const form = renderToStaticMarkup(React.createElement(ProductForm, {
    products: [product], categories: [], areas: [], busy: false, onSave() {}, onCancel() {},
  }));
  assert.ok(form.includes("Inventario"));
  assert.ok(!form.includes("Existencia inicial"));
  assert.ok(!form.includes("Stock"));
  assert.ok(form.includes("Tipo de producto"));
  const { ProductStatusConfirmDialog } = load("src/features/products/components/ProductStatusConfirmDialog.tsx");
  const confirmation = renderToStaticMarkup(React.createElement(ProductStatusConfirmDialog, {
    product, kind: "status", busy: false, onSave() {}, onCancel() {},
  }));
  assert.ok(confirmation.includes("histórica se conservará"));
  const { productInventoryPath } = load("src/features/products/utils/product-inventory.ts");
  assert.equal(productInventoryPath("25", false), null);
  const withoutDates = { ...detail, isCombo: true, components: [{ productId: "26", productName: "Pan", quantity: 1 }] };
  delete withoutDates.createdAt; delete withoutDates.updatedAt;
  assert.ok(schemas.comboResponseSchema.safeParse({ status: "success", data: { product: withoutDates } }).success);
  for (const [status, code] of [[409, "PRODUCT_SKU_CONFLICT"], [401, "AUTHENTICATION_REQUIRED"], [403, "FORBIDDEN"]]) {
    global.fetch = async () => new Response(JSON.stringify({ status: "error", code, message: "Mensaje especifico del servidor" }), { status });
    await assert.rejects(service.saveProduct({ kind: "edit", id: "25", isCombo: false, input: { name: "Cambio" } }, "admin-token", signal), e => e.code === code && e.message === "Mensaje especifico del servidor");
  }
  console.log("PASS: paginación, autorización, JSON, multipart sin Content-Type manual, combos, PATCH parcial, imágenes, estado, detalle, validación e inventario separado.");
})().catch(error => { console.error(error); process.exitCode = 1; });
