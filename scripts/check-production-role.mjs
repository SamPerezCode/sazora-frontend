import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Ejecutar con: node scripts/check-production-role.mjs
// Todas las peticiones HTTP se simulan; no se modifica ningún negocio.
// Carga TypeScript/TSX sin emitir archivos ni instalar un runner adicional.
const sourceRoot = new URL("../src/", import.meta.url);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith(".") &&
      context.parentURL?.startsWith(sourceRoot.href)
    ) {
      for (const extension of [".ts", ".tsx"]) {
        const url = new URL(specifier + extension, context.parentURL);
        if (existsSync(url)) return nextResolve(url.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.startsWith(sourceRoot.href) || !/\.tsx?$/.test(url))
      return nextLoad(url, context);
    let source = readFileSync(new URL(url), "utf8");
    if (url === new URL("config/env.ts", sourceRoot).href) {
      source = source.replaceAll("import.meta.env", "({})");
    }
    return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(source, {
        fileName: fileURLToPath(url),
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    };
  },
});
const originalFetch = globalThis.fetch;
const load = (path) => import(new URL(path, sourceRoot).href);

try {
  const auth = await load("features/auth/schemas/auth.schema.ts");
  const employees = await load(
    "features/employees/schemas/employee.schema.ts"
  );
  const assignments = await load(
    "features/employees/schemas/employee-location.schema.ts"
  );
  const plants = await load(
    "features/employees/utils/production-locations.ts"
  );
  const { getNavigation, ROLE_LABELS } = await load(
    "app/navigation.ts"
  );
  const { EmployeeRoles } = await load(
    "features/employees/components/EmployeeVisuals.tsx"
  );
  const { EmployeeForm } = await load(
    "features/employees/components/EmployeeForm.tsx"
  );
  const { getEmployees, saveEmployee } = await load(
    "features/employees/services/employee.service.ts"
  );
  const { ApiError, subscribeToUnauthorized } = await load(
    "lib/http/client.ts"
  );
  const { employeeErrorMessage } = await load(
    "features/employees/utils/employee-errors.ts"
  );

  const employee = {
    userId: "1",
    membershipId: "2",
    businessId: "3",
    fullName: "Empleado de producción",
    email: "produccion@example.test",
    isActive: true,
    membershipIsActive: true,
    roles: ["PRODUCTION"],
    lastLoginAt: null,
    createdAt: "2026-10-13T12:00:00Z",
    updatedAt: "2026-10-13T12:00:00Z",
    locationAccess: {
      hasGlobalAccess: false,
      defaultLocationId: null,
      locations: [],
    },
  };
  assert.equal(auth.roleSchema.parse("PRODUCTION"), "PRODUCTION");
  assert.deepEqual(
    auth.currentSessionSchema.parse({
      tokenType: "access",
      userId: "1",
      businessId: "3",
      membershipId: "2",
      authVersion: 1,
      roles: ["PRODUCTION"],
    }).roles,
    ["PRODUCTION"]
  );
  auth.loginResponseSchema.parse({
    status: "success",
    data: {
      accessToken: "test",
      user: { id: "1", fullName: employee.fullName },
      business: {
        id: "3",
        name: "Negocio de prueba",
        slug: "prueba",
      },
      membership: { id: "2", roles: ["PRODUCTION"] },
    },
  });
  employees.employeeListResponseSchema.parse({
    status: "success",
    data: { employees: [employee] },
  });
  employees.employeeResponseSchema.parse({
    status: "success",
    data: { employee },
  });

  const input = {
    fullName: employee.fullName,
    email: employee.email,
    password: "Produccion1234!",
    passwordConfirmation: "Produccion1234!",
    roles: ["PRODUCTION"],
  };
  assert.deepEqual(
    employees.employeeCreateSchema.parse(input).roles,
    ["PRODUCTION"]
  );
  const all = [
    "WAITER",
    "KITCHEN",
    "PRODUCTION",
    "PUBLIC_ORDER_MANAGER",
    "DELIVERY_DRIVER",
  ];
  assert.deepEqual(employees.assignableRoles, all);
  for (let mask = 1; mask < 32; mask++) {
    const roles = all.filter((_, index) => mask & (1 << index));
    assert.deepEqual(
      employees.employeeRolesSchema.parse([...roles, ...roles]),
      roles
    );
  }
  for (const invalid of [
    [],
    ["ADMIN"],
    ["Producción"],
    ["production"],
    ["OTHER"],
  ]) {
    assert.equal(
      employees.employeeRolesSchema.safeParse(invalid).success,
      false
    );
  }

  assert.equal(ROLE_LABELS.PRODUCTION, "Producción");
  const normalize = (text) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  assert.equal(normalize(ROLE_LABELS.PRODUCTION), "produccion");
  assert.match(
    renderToStaticMarkup(
      createElement(EmployeeRoles, { roles: all })
    ),
    /Producción/
  );
  const rolesMarkup = renderToStaticMarkup(
    createElement(EmployeeForm, {
      editor: { kind: "roles", employee },
      busy: false,
      onSave: async () => {},
      onCancel: () => {},
    })
  );
  assert.match(
    rolesMarkup,
    /Procesos de planta, producción y productos terminados/
  );
  assert.match(rolesMarkup, /Después de guardar, verifica/);
  assert.deepEqual(
    getNavigation(["PRODUCTION"]).map((item) => item.id),
    ["panel"]
  );
  assert.deepEqual(
    getNavigation(["PRODUCTION", "KITCHEN"]).map((item) => item.id),
    ["panel", "kitchen"]
  );

  const point = Object.freeze({
    id: "1",
    locationType: "POINT_OF_SALE",
    isActive: true,
  });
  const inactive = Object.freeze({
    id: "2",
    locationType: "PRODUCTION_WAREHOUSE",
    isActive: false,
  });
  const plant = Object.freeze({
    id: "3",
    locationType: "PRODUCTION_WAREHOUSE",
    isActive: true,
  });
  const locations = Object.freeze([point, inactive, plant]);
  assert.deepEqual(
    plants
      .sortEmployeeLocations(locations, ["PRODUCTION"])
      .map((l) => l.id),
    ["3", "1", "2"]
  );
  assert.deepEqual(
    locations.map((l) => l.id),
    ["1", "2", "3"]
  );
  assert.deepEqual(
    plants.sortEmployeeLocations(locations, ["KITCHEN"]),
    locations
  );
  assert.equal(
    plants.hasSelectedProductionPlant(locations, []),
    false
  );
  assert.equal(
    plants.hasSelectedProductionPlant(locations, ["1"]),
    false
  );
  assert.equal(
    plants.hasSelectedProductionPlant(locations, ["2"]),
    false
  );
  assert.equal(
    plants.hasSelectedProductionPlant(locations, ["3"]),
    true
  );
  assert.deepEqual(
    assignments.normalizeEmployeeAssignments(
      ["1", "2", "3"],
      "3",
      locations
    ),
    [
      { locationId: "1", isDefault: false },
      { locationId: "3", isDefault: true },
    ]
  );
  assert.deepEqual(
    assignments.normalizeEmployeeAssignments([], null, locations),
    []
  );
  assert.throws(() =>
    assignments.normalizeEmployeeAssignments(
      ["1", "3"],
      null,
      locations
    )
  );

  const calls = [];
  globalThis.fetch = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({
      path: new URL(url).pathname,
      method: options.method,
      body,
    });
    const result =
      options.method === "GET"
        ? { employees: [employee] }
        : { employee: { ...employee, roles: body.roles } };
    return Response.json({ status: "success", data: result });
  };
  const signal = new AbortController().signal;
  await getEmployees("test", signal);
  await saveEmployee({ kind: "create", input }, "test", signal);
  await saveEmployee(
    {
      kind: "roles",
      membershipId: "2",
      roles: ["PRODUCTION", "KITCHEN"],
    },
    "test",
    signal
  );
  const saved = await saveEmployee(
    { kind: "roles", membershipId: "2", roles: ["KITCHEN"] },
    "test",
    signal
  );
  assert.deepEqual(saved.roles, ["KITCHEN"]);
  assert.deepEqual(
    calls.map((c) => c.method),
    ["GET", "POST", "PUT", "PUT"]
  );
  assert.deepEqual(calls[1].body.roles, ["PRODUCTION"]);
  assert.deepEqual(calls[2].body, {
    roles: ["PRODUCTION", "KITCHEN"],
  });
  assert.deepEqual(calls[3].body, { roles: ["KITCHEN"] });
  assert.equal(
    calls.some((c) => c.path.endsWith("/locations")),
    false
  );

  globalThis.fetch = async () =>
    Response.json(
      {
        status: "error",
        code: "VALIDATION_ERROR",
        message: "Revisa los roles.",
        errors: [
          {
            field: "roles",
            message: "Selecciona un rol disponible.",
          },
        ],
      },
      { status: 400 }
    );
  await assert.rejects(
    saveEmployee(
      { kind: "roles", membershipId: "2", roles: ["PRODUCTION"] },
      "test",
      signal
    ),
    (error) =>
      error instanceof ApiError && error.errors[0].field === "roles"
  );
  assert.equal(
    employeeErrorMessage(
      new ApiError(409, "EMPLOYEE_ROLE_NOT_AVAILABLE", "original"),
      ""
    ),
    "El rol seleccionado no está disponible."
  );
  assert.match(
    employeeErrorMessage(
      new ApiError(404, "EMPLOYEE_NOT_FOUND", "original"),
      ""
    ),
    /ya no existe/
  );
  assert.equal(
    employeeErrorMessage(
      new ApiError(403, "FORBIDDEN", "original"),
      ""
    ),
    "No tienes permisos para administrar empleados."
  );

  let expired = false;
  const unsubscribe = subscribeToUnauthorized(() => {
    expired = true;
  });
  globalThis.fetch = async () =>
    Response.json(
      {
        status: "error",
        code: "AUTHENTICATION_REQUIRED",
        message: "Sesión expirada.",
      },
      { status: 401 }
    );
  await assert.rejects(
    saveEmployee(
      { kind: "roles", membershipId: "2", roles: ["PRODUCTION"] },
      "test",
      signal
    )
  );
  assert.equal(expired, true);
  unsubscribe();
  console.log(
    "PRODUCTION: contratos, combinaciones, presentación, permisos, plantas, peticiones y errores verificados."
  );
} finally {
  globalThis.fetch = originalFetch;
  hooks.deregister();
}
