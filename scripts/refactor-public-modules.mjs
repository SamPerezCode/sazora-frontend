import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ESLint } from "eslint";

const root = process.cwd();
const apply = process.argv.includes("--write");

const absolute = (name) => path.resolve(root, name);

const key = (name) =>
  absolute(name).replaceAll("\\", "/").toLowerCase();

const read = (name) => fs.readFileSync(absolute(name), "utf8");

const relativeImport = (from, to) => {
  let result = path
    .relative(path.dirname(absolute(from)), absolute(to))
    .replaceAll("\\", "/")
    .replace(/\.(tsx?|jsx?)$/, "");

  if (!result.startsWith(".")) result = "./" + result;

  return result;
};

if (!fs.existsSync(absolute("tsconfig.app.json"))) {
  throw new Error("Ejecuta este script desde la raíz de sazora-web.");
}

const config = ts.readConfigFile(
  absolute("tsconfig.app.json"),
  ts.sys.readFile
);

if (config.error) {
  throw new Error(
    ts.flattenDiagnosticMessageText(config.error.messageText, "\n")
  );
}

const parsed = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  root
);

if (parsed.errors.length) {
  throw new Error("No se pudo leer tsconfig.app.json.");
}

const compilerOptions = {
  ...parsed.options,
  noEmit: true,
  incremental: false,
  tsBuildInfoFile: undefined,
};

const originalProgram = ts.createProgram(
  parsed.fileNames,
  compilerOptions
);

const checker = originalProgram.getTypeChecker();

const originals = new Map();
const sources = new Map();
const bindings = new Map();
const owners = new Map();
const groups = new Map();
const generated = new Map();

function resolveSymbol(symbol) {
  return symbol && symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}

function source(name) {
  if (sources.has(name)) return sources.get(name);

  const file = originalProgram.getSourceFile(absolute(name));

  if (!file) {
    throw new Error("No se encontró " + name);
  }

  originals.set(name, read(name));
  sources.set(name, file);

  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !statement.importClause
    ) {
      continue;
    }

    const module = statement.moduleSpecifier.text;
    const clause = statement.importClause;

    if (clause.name) {
      bindings.set(checker.getSymbolAtLocation(clause.name), {
        module,
        imported: "default",
        local: clause.name.text,
        type: clause.isTypeOnly,
        source: name,
      });
    }

    if (
      clause.namedBindings &&
      ts.isNamedImports(clause.namedBindings)
    ) {
      for (const element of clause.namedBindings.elements) {
        bindings.set(checker.getSymbolAtLocation(element.name), {
          module,
          imported: element.propertyName?.text ?? element.name.text,
          local: element.name.text,
          type: clause.isTypeOnly || element.isTypeOnly,
          source: name,
        });
      }
    } else if (clause.namedBindings) {
      throw new Error(
        "Import de namespace no contemplado en " + name
      );
    }
  }

  return file;
}

function declarationNames(node) {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.map((declaration) => {
      if (!ts.isIdentifier(declaration.name)) {
        throw new Error("Declaración no compatible.");
      }

      return declaration.name;
    });
  }

  return node.name && ts.isIdentifier(node.name) ? [node.name] : [];
}

function move(from, to, names) {
  const file = source(from);
  const wanted = names.split(" ");
  const entries = [];

  for (const name of wanted) {
    const node = file.statements.find((candidate) =>
      declarationNames(candidate).some(
        (identifier) => identifier.text === name
      )
    );

    if (!node) {
      throw new Error("No se encontró " + name + " en " + from);
    }

    entries.push({ node, from });

    for (const identifier of declarationNames(node)) {
      const symbol = resolveSymbol(
        checker.getSymbolAtLocation(identifier)
      );

      if (owners.has(symbol)) {
        throw new Error("Declaración repetida: " + name);
      }

      owners.set(symbol, {
        file: to,
        name: identifier.text,
        type:
          ts.isTypeAliasDeclaration(node) ||
          ts.isInterfaceDeclaration(node),
      });
    }
  }

  groups.set(to, [...(groups.get(to) ?? []), ...entries]);
}

const sales = "src/features/sales/";
const menu = "src/features/public-menu/";

const salesPage = sales + "PublicOrdersPage.tsx";
const salesApi = sales + "public-orders.api.ts";
const menuApi = menu + "public-menu.api.ts";

/*
 * Ventas: utilidades, hooks, componentes y páginas.
 */

move(
  salesPage,
  sales + "utils/public-orders.utils.ts",
  "labels options allLocations text pending active"
);

move(
  salesPage,
  sales + "hooks/usePublicOrdersPresentation.ts",
  "usePresentation"
);

move(
  salesPage,
  sales + "components/public-orders/PublicOrderShared.tsx",
  "Badge Service External Feedback Pager Items Address"
);

move(
  salesPage,
  sales + "components/public-orders/PublicRequestList.tsx",
  "RequestList"
);

move(
  salesPage,
  sales + "components/public-orders/PublicRequestDialog.tsx",
  "RequestDialog"
);

move(
  salesPage,
  sales + "components/deliveries/DeliveryList.tsx",
  "DeliveryList"
);

move(
  salesPage,
  sales + "components/deliveries/DeliveryDialog.tsx",
  "DeliveryDialog"
);

move(
  salesPage,
  sales + "components/deliveries/AssignmentForm.tsx",
  "AssignmentForm"
);

move(
  salesPage,
  sales + "pages/PublicOrdersPage.tsx",
  "PublicOrdersPage"
);

move(salesPage, sales + "pages/DeliveriesPage.tsx", "DeliveriesPage");

move(
  sales + "usePublicOrders.ts",
  sales + "hooks/usePublicOrders.ts",
  "message useRemote useMutation"
);

/*
 * Ventas: esquemas separados de las llamadas HTTP.
 */

move(
  salesApi,
  sales + "schemas/public-orders.schema.ts",
  [
    "id",
    "amount",
    "date",
    "requestStates",
    "deliveryStates",
    "base",
    "item",
    "detail",
    "listItem",
    "deliverySchema",
    "requestResponse",
    "orderResponse",
    "deliveryResponse",
    "RequestRow",
    "RequestDetail",
    "Delivery",
    "RequestAction",
    "DeliveryAction",
    "Assignment",
  ].join(" ")
);

move(
  salesApi,
  sales + "services/public-orders.service.ts",
  "requestPath listRequests readRequest changeRequest"
);

move(
  salesApi,
  sales + "services/deliveries.service.ts",
  "listDeliveries readDelivery assignDelivery advanceDelivery"
);

/*
 * Menú público: esquemas, servicios y utilidades.
 */

move(
  menuApi,
  menu + "schemas/public-menu.schema.ts",
  [
    "idSchema",
    "amountSchema",
    "dateSchema",
    "slugSchema",
    "requestStatusSchema",
    "serviceSchema",
    "businessSchema",
    "locationSchema",
    "productSchema",
    "menuSchema",
    "menuResponseSchema",
    "checkoutSchema",
    "itemsSchema",
    "submittedResponseSchema",
    "trackingSchema",
    "trackingResponseSchema",
    "publicWhatsAppStateSchema",
    "PublicBusiness",
    "PublicMenu",
    "PublicLocation",
    "PublicProduct",
    "PublicTracking",
    "CheckoutDraft",
    "CartLine",
    "CartRow",
  ].join(" ")
);

move(
  menuApi,
  menu + "services/public-menu.service.ts",
  "basePath getPublicMenu sendPublicOrder getPublicTracking"
);

move(
  menuApi,
  menu + "utils/public-order-notes.ts",
  "publicOrderNotes"
);

move(
  menuApi,
  menu + "utils/public-menu-theme.ts",
  "safeColor contrastText themeFor"
);

move(
  menuApi,
  menu + "utils/public-order-whatsapp.ts",
  "buildWhatsAppOrderMessage"
);

/*
 * Utilidades que comparten Ventas y Menú público.
 */

move(menuApi, "src/lib/money.ts", "cents money");

move(
  menuApi,
  "src/lib/whatsapp.ts",
  "normalizeWhatsAppPhone buildWhatsAppUrl"
);

/*
 * Menú público: páginas y componentes.
 */

move(
  menu + "PublicMenuPage.tsx",
  menu + "utils/public-menu.utils.ts",
  "getInstagramHandle normalize"
);

move(
  menu + "PublicMenuPage.tsx",
  menu + "pages/PublicMenuPage.tsx",
  "PublicMenuPage"
);

move(
  menu + "PublicMenuPage.tsx",
  menu + "components/MenuLoader.tsx",
  "MenuLoader"
);

move(
  menu + "PublicMenuPage.tsx",
  menu + "components/MenuContent.tsx",
  "Dialog MenuContent"
);

move(
  menu + "PublicOrderTrackingPage.tsx",
  menu + "utils/public-order-status.ts",
  "statusOf"
);

move(
  menu + "PublicOrderTrackingPage.tsx",
  menu + "pages/PublicOrderTrackingPage.tsx",
  "PublicOrderTrackingPage"
);

move(
  menu + "PublicOrderTrackingPage.tsx",
  menu + "components/TrackingContent.tsx",
  "TrackingContent"
);

for (const name of [
  "MenuImage",
  "Quantity",
  "ProductDialog",
  "CartDialog",
  "CheckoutDialog",
]) {
  move(
    menu + "PublicMenuDialogs.tsx",
    menu + "components/" + name + ".tsx",
    name
  );
}

/*
 * El router conserva sus rutas.
 * Solo se reconstruyen sus imports.
 */

const router = "src/app/router/AppRouter.tsx";
move(router, router, "AppRouter");

/*
 * Entradas pequeñas para las páginas de Ventas.
 * Conservan el reinicio de estado al cambiar de sesión.
 */

for (const [page, component, folder] of [
  [
    "PublicOrdersPage",
    "RequestList",
    "public-orders/PublicRequestList",
  ],
  ["DeliveriesPage", "DeliveryList", "deliveries/DeliveryList"],
]) {
  generated.set(
    sales + "pages/" + page + ".tsx",
    [
      'import { useAppShell } from "../../../app/layout/shell-context";',
      "import { " +
        component +
        ' } from "../components/' +
        folder +
        '";',
      'import "../public-orders.css";',
      "",
      "export function " + page + "() {",
      "  const { session } = useAppShell();",
      "  const scope = JSON.stringify([",
      "    session.business.id, session.membership.id,",
      "    session.accessToken, session.authorization.permissions,",
      "  ]);",
      "  return <" + component + " key={scope} />;",
      "}",
      "",
    ].join("\n")
  );
}

/*
 * Construye imports a partir de los símbolos de TypeScript.
 * Las referencias locales no se confunden con imports
 * que tengan el mismo nombre.
 */

for (const [target, entries] of groups) {
  if (generated.has(target)) continue;

  const imports = new Map();

  function addImport(module, imported, local, type) {
    const id = module + ":" + local;
    const previous = imports.get(id);

    imports.set(id, {
      module,
      imported,
      local,
      type: previous ? previous.type && type : type,
    });
  }

  function visit(node) {
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      const owner = owners.get(resolveSymbol(symbol));

      if (owner && owner.file !== target) {
        addImport(
          relativeImport(target, owner.file),
          owner.name,
          node.text,
          owner.type
        );
      } else if (!owner) {
        const binding = bindings.get(symbol);

        if (binding) {
          const module = binding.module.startsWith(".")
            ? relativeImport(
                target,
                path.resolve(
                  path.dirname(absolute(binding.source)),
                  binding.module
                )
              )
            : binding.module;

          addImport(
            module,
            binding.imported,
            binding.local,
            binding.type
          );
        } else if (
          symbol?.declarations?.some(
            (declaration) =>
              [...sources.values()].includes(
                declaration.getSourceFile()
              ) && declaration.parent === declaration.getSourceFile()
          )
        ) {
          throw new Error(
            "Dependencia sin destino: " + node.text + " en " + target
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  for (const entry of entries) visit(entry.node);

  const importLines = [...imports.values()]
    .sort((a, b) =>
      (a.module + a.local).localeCompare(b.module + b.local)
    )
    .map((item) => {
      const names =
        item.imported === "default"
          ? item.local
          : "{ " +
            item.imported +
            (item.imported !== item.local
              ? " as " + item.local
              : "") +
            " }";

      return (
        "import " +
        (item.type ? "type " : "") +
        names +
        " from " +
        JSON.stringify(item.module) +
        ";"
      );
    });

  const body = entries
    .map(({ node, from }) => {
      const content = node.getText(source(from));

      return content.startsWith("export ")
        ? content
        : "export " + content;
    })
    .join("\n\n");

  if (
    target === menu + "pages/PublicMenuPage.tsx" ||
    target === menu + "pages/PublicOrderTrackingPage.tsx"
  ) {
    importLines.push('import "../public-menu.css";');
  }

  generated.set(
    target,
    importLines.join("\n") + "\n\n" + body + "\n"
  );
}

/*
 * Validación del proyecto completo con archivos virtuales.
 * No escribe ni genera archivos de compilación.
 */

const removed = [...sources.keys()].filter((name) => name !== router);

const deletedKeys = new Set(removed.map(key));

const virtual = new Map(
  [...generated].map(([name, code]) => [key(name), code])
);

const directories = new Set();

for (const name of generated.keys()) {
  let directory = path.dirname(absolute(name));

  while (directory !== path.dirname(directory)) {
    directories.add(key(directory));
    directory = path.dirname(directory);
  }
}

for (const name of generated.keys()) {
  if (name !== router && fs.existsSync(absolute(name))) {
    throw new Error(
      "El destino ya existe; no se sobrescribirá: " + name
    );
  }
}

const host = ts.createCompilerHost(compilerOptions);

const oldRead = host.readFile.bind(host);
const oldExists = host.fileExists.bind(host);
const oldDirectory = host.directoryExists?.bind(host);

host.readFile = (name) =>
  deletedKeys.has(key(name))
    ? undefined
    : (virtual.get(key(name)) ?? oldRead(name));

host.fileExists = (name) =>
  !deletedKeys.has(key(name)) &&
  (virtual.has(key(name)) || oldExists(name));

host.directoryExists = (name) =>
  directories.has(key(name)) || Boolean(oldDirectory?.(name));

const program = ts.createProgram(
  [
    ...parsed.fileNames.filter((name) => !deletedKeys.has(key(name))),
    ...[...generated.keys()].map(absolute),
  ],
  compilerOptions,
  host
);

const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    })
  );

  throw new Error(
    "La validación TypeScript falló. No se escribió ningún archivo."
  );
}

const eslint = new ESLint({
  cwd: root,
  fix: false,
});

let lintErrors = 0;

for (const [name, code] of generated) {
  const results = await eslint.lintText(code, {
    filePath: absolute(name),
  });

  for (const result of results) {
    lintErrors += result.errorCount + result.warningCount;

    for (const issue of result.messages) {
      console.error(name + ":" + issue.line + " " + issue.message);
    }
  }
}

if (lintErrors) {
  throw new Error(
    "ESLint encontró problemas. No se escribió ningún archivo."
  );
}

console.log("TypeScript y ESLint: correctos.");

for (const name of generated.keys()) {
  console.log((name === router ? "Actualizar: " : "Crear: ") + name);
}

for (const name of removed) {
  console.log("Retirar después de extraer: " + name);
}

/*
 * Aplicación explícita con --write.
 */

if (apply) {
  for (const [name, content] of originals) {
    if (read(name) !== content) {
      throw new Error(
        "El archivo cambió durante la revisión: " + name
      );
    }
  }

  const written = [];

  try {
    for (const [name, code] of generated) {
      fs.mkdirSync(path.dirname(absolute(name)), {
        recursive: true,
      });

      fs.writeFileSync(absolute(name), code, "utf8");
      written.push(name);
    }

    for (const name of removed) {
      fs.unlinkSync(absolute(name));
    }

    console.log(
      "Refactor aplicado. No cambian las rutas ni los endpoints."
    );
  } catch (error) {
    for (const [name, content] of originals) {
      fs.writeFileSync(absolute(name), content, "utf8");
    }

    for (const name of written) {
      if (!originals.has(name) && fs.existsSync(absolute(name))) {
        fs.unlinkSync(absolute(name));
      }
    }

    throw error;
  }
} else {
  console.log(
    "Revisión terminada sin escribir. Para aplicar: " +
      "node scripts/refactor-public-modules.mjs --write"
  );
}
