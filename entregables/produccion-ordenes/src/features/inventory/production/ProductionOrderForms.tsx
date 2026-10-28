import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import type { AuthSession } from "../../auth/types/auth.types";
import { DateField } from "../../../components/forms/DateField";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { Button } from "../components/InventoryButton";
import { Choice, Field, Modal, Notice } from "../components/InventoryLocationUI";
import { InventoryResponsiveRecords as Records } from "../components/InventoryResponsiveRecords";
import { loadBalances } from "../services/inventory-location.service";
import { add, cost, divide, fixed, multiply, quantity, quantity3, subtract, unit } from "../utils/inventory-value";
import { dayKey } from "../utils/inventory-format";
import type { OrderResources } from "./production.api";
import { getRecipe, listRecipes, loadPlants } from "./production.api";
import { completeOrderSchema, editOrderSchema, positiveQuantity, wasteInputSchema } from "./production.contracts";
import type { Action, Mutation } from "./production.contracts";
import { productionRoles } from "./production.access";
import { Metrics, Warning } from "./production.view";
import { cash, errorText, estimate, percentage, plannedISO } from "./production.format";

export interface FormContext {
  data: OrderResources; currency: string; zone: string;
  busy: boolean; locked: boolean; error: string;
  onClose: () => void; commit: (mutation: Mutation) => Promise<void>;
}
function Frame({ context: c, title, footer, children }: {
  context: FormContext; title: string; footer: ReactNode; children: ReactNode;
}) {
  return <Modal title={title} wide busy={c.busy} onClose={c.onClose} footer={footer}>
    <div className="grid min-w-0 gap-5">
      <p className="text-sm text-muted">{c.data.order.recipe.code} · {c.data.order.recipe.name} · {c.data.order.location.name} · Versión {c.data.order.version}</p>
      {c.error && <div role="alert" className="whitespace-pre-line rounded-xl border border-red-500/30 p-3 text-sm text-red-600 dark:text-red-400">{c.error}</div>}
      <fieldset disabled={c.busy || c.locked} className="m-0 grid min-w-0 gap-5 border-0 p-0">{children}</fieldset>
    </div>
  </Modal>;
}
export function TransitionForm({ context: c, action }: { context: FormContext; action: "plan" | "start" | "cancel" }) {
  const [reason, setReason] = useState("");
  const order = c.data.order;
  const title = action === "plan" ? "Planificar" : action === "start" ? "Iniciar" : "Cancelar";
  const invalid = action === "plan" ? !order.plannedFor : action === "cancel" ? reason.trim().length < 3 : false;
  return <Frame context={c} title={title + " OP-" + order.id} footer={<>
    <Button variant="secondary" disabled={c.busy} onClick={c.onClose}>Cerrar</Button>
    <Button variant={action === "cancel" ? "danger" : "primary"} loading={c.busy} disabled={c.locked || invalid}
      onClick={() => void c.commit(action === "cancel"
        ? { action, payload: { version: order.version, cancellationReason: reason.trim() } }
        : { action, payload: { version: order.version } })}>{title} OP-{order.id}</Button>
  </>}>
    {action === "cancel" ? <>
      <Warning>Se cancelará esta orden. No se modificarán las existencias.</Warning>
      <Field label="Motivo obligatorio" value={reason} onChange={setReason} multiline maxLength={500} placeholder="Explica por qué se cancela la orden" />
    </> : <Notice>{action === "plan"
      ? order.plannedFor ? "La orden quedará planificada; el inventario no se reserva ni se descuenta todavía." : "Edita el borrador y asigna una fecha prevista antes de planificar."
      : "La orden pasará a En proceso. Las existencias se aplicarán al completar."}</Notice>}
  </Frame>;
}
export function EditOrderForm({ context: c }: { context: FormContext }) {
  const order = c.data.order;
  const [recipeId, setRecipe] = useState(order.recipe.id);
  const [locationId, setLocation] = useState(order.location.id);
  const [batch, setBatch] = useState(order.batchQuantity);
  const [day, setDay] = useState(order.plannedFor ? dayKey(order.plannedFor, c.zone) : "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [step, setStep] = useState(1);
  const [validation, setValidation] = useState("");
  const catalogLoader = useCallback(async (session: AuthSession, signal: AbortSignal) => {
    const [recipes, plants] = await Promise.all([listRecipes(session, signal), loadPlants(session, signal)]);
    return { recipes, plants };
  }, []);
  const catalog = useInventoryQuery("production-edit-catalog", catalogLoader, 0, productionRoles);
  const projectionLoader = useCallback(async (session: AuthSession, signal: AbortSignal) => {
    const [recipe, balances] = await Promise.all([getRecipe(session, signal, recipeId), loadBalances(session, signal, locationId)]);
    return { recipe, balances };
  }, [recipeId, locationId]);
  const projection = useInventoryQuery("production-projection:" + recipeId + ":" + locationId, projectionLoader, 0, productionRoles);
  const recipe = projection.data?.recipe;
  const batchValid = positiveQuantity.safeParse(batch).success;
  const planned = (value: string) => quantity3(multiply(value, batch));
  const payload = () => editOrderSchema.parse({
    version: order.version, recipeId, locationId, batchQuantity: batch,
    plannedFor: plannedISO(day, c.zone, order.plannedFor), notes: notes.trim() || null,
  });
  function next() {
    try {
      payload();
      if (!recipe?.isActive) throw new Error("Selecciona una receta activa.");
      if (!catalog.data?.plants.some(plant => plant.id === locationId)) throw new Error("Selecciona una planta activa.");
      if ([...recipe.inputs, ...recipe.outputs].some(line => fixed(planned(line.quantity)) <= 0n))
        throw new Error("El lote produce una cantidad demasiado pequeña.");
      setValidation(""); setStep(value => value + 1);
    } catch (error) { setValidation(errorText(error)); }
  }
  const blocked = c.locked || catalog.pending || projection.pending || !!catalog.error || !!projection.error;
  return <Frame context={c} title="Editar orden en borrador" footer={<>
    {step > 1 && <Button variant="ghost" disabled={c.busy} onClick={() => setStep(value => value - 1)}>Atrás</Button>}
    <Button variant="secondary" disabled={c.busy} onClick={c.onClose}>Cancelar</Button>
    <Button loading={c.busy} disabled={blocked} onClick={() => {
      if (step < 3) next();
      else { try { void c.commit({ action: "edit", payload: payload() }); } catch (error) { setValidation(errorText(error)); } }
    }}>{step < 3 ? "Continuar" : "Guardar cambios"}</Button>
  </>}>
    <p className="text-sm text-muted">Paso {step} de 3 · {["Planificación", "Proyección", "Revisión"][step - 1]}</p>
    {validation && <p role="alert" className="whitespace-pre-line text-red-600 dark:text-red-400">{validation}</p>}
    {(catalog.pending || projection.pending) && <Notice>Cargando receta y disponibilidad…</Notice>}
    {(catalog.error || projection.error) && <Notice>{catalog.error || projection.error} <Button variant="secondary" onClick={() => { catalog.refresh(); projection.refresh(); }}>Reintentar</Button></Notice>}
    {step === 1 && <div className="grid gap-4 md:grid-cols-2">
      <Choice label="Planta" value={locationId} onValueChange={setLocation}
        options={(catalog.data?.plants ?? []).map(plant => ({ value: plant.id, label: plant.name + " · " + plant.code }))} />
      <Choice label="Receta" value={recipeId} onValueChange={setRecipe}
        options={(catalog.data?.recipes ?? []).filter(row => row.isActive || row.id === recipeId).map(row =>
          ({ value: row.id, label: row.code + " · " + row.name + (row.isActive ? "" : " · Inactiva") }))} />
      <Field label="Cantidad de lotes" value={batch} onChange={setBatch} decimal placeholder="Ej. 1" />
      <DateField label="Fecha prevista" value={day} onValueChange={setDay} timeZone={c.zone} />
    </div>}
    {recipe && batchValid && !projection.pending && !projection.error && <>
      <div><h3 className="font-semibold">{recipe.code} · {recipe.name}</h3>
        <p className="text-sm text-muted">Rendimiento por lote: {recipe.outputs.map(line => quantity(line.quantity, line.baseUnit) + " " + line.inventoryItemName).join(" · ")}</p></div>
      <Records label="Proyección de insumos" rows={recipe.inputs.map(line => {
        const balance = projection.data!.balances.find(b => b.inventoryItemId === line.inventoryItemId);
        return { id: line.id, fields: [
          { label: "Insumo", value: line.inventoryItemName },
          { label: "Por lote", value: quantity(line.quantity, line.baseUnit) },
          { label: "Lotes", value: batch },
          { label: "Cantidad estimada", value: quantity(planned(line.quantity), line.baseUnit) },
          { label: "Disponible", value: balance ? quantity(balance.currentStock, line.baseUnit) : "Sin saldo registrado" },
          { label: "Disponibilidad", value: balance && fixed(balance.currentStock) >= fixed(planned(line.quantity)) ? "Disponible" : "Insuficiente" },
        ] };
      })} />
      {step > 1 && <Records label="Resultados esperados" rows={recipe.outputs.map(line => ({ id: line.id, fields: [
        { label: "Producto obtenido", value: line.inventoryItemName },
        { label: "Cantidad esperada", value: quantity(planned(line.quantity), line.baseUnit) },
        { label: "Asignación del costo", value: percentage(line.costAllocationPercentage) },
      ] }))} />}
    </>}
    {step < 3 ? <Field label="Notas" value={notes} onChange={setNotes} multiline maxLength={500} placeholder="Indicaciones para esta orden" />
      : <><Notice>La orden seguirá en borrador y usará la receta vigente. No se aplicarán cambios al inventario.</Notice><p>{notes || "Sin notas"}</p></>}
  </Frame>;
}
export function ExecutionForm({ context: c, action }: { context: FormContext; action: Extract<Action, "complete" | "waste"> }) {
  const { session } = useAppShell();
  const order = c.data.order;
  const lines = [...order.inputs, ...order.outputs];
  const [actual, setActual] = useState<Record<string, string>>(
    Object.fromEntries(lines.map(line => [line.inventoryItemId, line.plannedQuantity]))
  );
  const [waste, setWaste] = useState([{ key: crypto.randomUUID(), inventoryItemId: "", quantity: "", notes: "" }]);
  const [reason, setReason] = useState("");
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [validation, setValidation] = useState("");
  const isWaste = action === "waste";
  const validAmounts = lines.every(line => positiveQuantity.safeParse(actual[line.inventoryItemId]).success);
  const preview = !isWaste && validAmounts ? estimate(order, c.data.balances, actual) : null;
  const wasteCosts = waste.map(line => {
    const balance = c.data.balances?.find(b => b.inventoryItemId === line.inventoryItemId);
    return balance?.valuationStatus === "VALUED" && balance.averageUnitCost !== null &&
      positiveQuantity.safeParse(line.quantity).success ? multiply(line.quantity, balance.averageUnitCost) : null;
  });
  const wasteTotal = wasteCosts.some(value => value === null) ? null : wasteCosts.reduce<string>((sum, value) => add(sum, value!), "0");
  function mutation(): Mutation {
    if (isWaste) return { action: "waste", payload: wasteInputSchema.parse({
      version: order.version, reason,
      lines: waste.map(({ inventoryItemId, quantity: value, notes }) => ({ inventoryItemId, quantity: value, notes: notes.trim() || null })),
    }) };
    return { action: "complete", payload: completeOrderSchema.parse({
      version: order.version,
      inputs: order.inputs.map(line => ({ inventoryItemId: line.inventoryItemId, quantity: actual[line.inventoryItemId] })),
      outputs: order.outputs.map(line => ({ inventoryItemId: line.inventoryItemId, quantity: actual[line.inventoryItemId] })),
    }) };
  }
  function next() {
    try { mutation(); setValidation(""); setConfirmed(false); setStep(2); }
    catch (error) { setValidation(errorText(error)); }
  }
  const reviewRows = isWaste ? (step === 2 ? waste : []).map(line => {
    const item = lines.find(item => item.inventoryItemId === line.inventoryItemId)!;
    return { id: line.key, fields: [
      { label: "Artículo", value: item.inventoryItemName },
      { label: "Cantidad real", value: quantity(line.quantity, item.baseUnit) },
      { label: "Asignación", value: "Desperdicio explícito" },
    ] };
  }) : lines.map(line => ({ id: line.inventoryItemId, fields: [
    { label: "Artículo", value: line.inventoryItemName },
    { label: "Cantidad real", value: validAmounts ? quantity(actual[line.inventoryItemId], line.baseUnit) : "—" },
    { label: "Asignación", value: "costAllocationPercentage" in line && typeof line.costAllocationPercentage === "string" ? percentage(line.costAllocationPercentage) : "Consumo" },
  ] }));
  return <Frame context={c} title={(isWaste ? "Registrar desperdicio · OP-" : "Completar OP-") + order.id} footer={<>
    {step === 2 && <Button variant="ghost" disabled={c.busy} onClick={() => { setStep(1); setConfirmed(false); }}>Atrás</Button>}
    <Button variant="secondary" disabled={c.busy} onClick={c.onClose}>Cancelar</Button>
    <Button loading={c.busy} disabled={c.locked || (step === 2 && !confirmed)}
      onClick={() => {
        if (step === 1) next();
        else { try { void c.commit(mutation()); } catch (error) { setValidation(errorText(error)); } }
      }}>{step === 1 ? "Continuar" : isWaste ? "Registrar desperdicio" : "Completar y aplicar al inventario"}</Button>
  </>}>
    {validation && <p role="alert" className="whitespace-pre-line text-red-600 dark:text-red-400">{validation}</p>}
    {isWaste && <Warning>Las variaciones de consumo o rendimiento no se registran automáticamente como desperdicio. Registra únicamente una pérdida física identificada.</Warning>}
    {step === 1 && (isWaste ? <>
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Desperdicios</h3>
        <Button variant="ghost" disabled={waste.length >= lines.length || waste.length >= 100} onClick={() => setWaste(previous => [...previous, { key: crypto.randomUUID(), inventoryItemId: "", quantity: "", notes: "" }])}><Plus size={16} />Agregar línea</Button></div>
      {waste.map((line, index) => {
        const item = lines.find(item => item.inventoryItemId === line.inventoryItemId);
        const balance = c.data.balances?.find(b => b.inventoryItemId === line.inventoryItemId);
        const update = (patch: Partial<typeof line>) => setWaste(previous => previous.map((row, i) => i === index ? { ...row, ...patch } : row));
        return <div key={line.key} className="grid gap-3 border-b border-outline pb-4">
          <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <Choice label="Artículo" value={line.inventoryItemId} onValueChange={inventoryItemId => update({ inventoryItemId })}
              options={lines.filter(item => item.inventoryItemId === line.inventoryItemId || !waste.some(row => row.inventoryItemId === item.inventoryItemId)).map(item =>
                ({ value: item.inventoryItemId, label: item.inventoryItemName + " · " + (item.inventoryItemSku || "Sin SKU") + " · " + unit(item.baseUnit) }))} />
            <Field label={"Cantidad" + (item ? " · " + unit(item.baseUnit, "2") : "")} value={line.quantity} onChange={value => update({ quantity: value })} decimal placeholder="Ej. 0.100" />
            <Button variant="ghost" aria-label={"Eliminar línea " + (index + 1)} disabled={waste.length === 1} onClick={() => setWaste(previous => previous.filter(row => row.key !== line.key))}><Trash2 size={17} /></Button>
          </div>
          {item && <p className="text-xs text-muted">Disponible: {balance ? quantity(balance.currentStock, item.baseUnit) : "Se validará al confirmar"} · Costo estimado: {cash(wasteCosts[index], c.currency)}</p>}
          <Field label="Notas de la línea (opcional)" value={line.notes} onChange={notes => update({ notes })} maxLength={500} placeholder="Describe la pérdida" />
        </div>;
      })}
      <Field label="Motivo obligatorio" value={reason} onChange={setReason} maxLength={500} placeholder="Explica qué ocurrió" multiline />
      <p className="text-xs text-muted">Responsable: {session.user.fullName}</p>
    </> : <>
      {(["inputs", "outputs"] as const).map(group => <section key={group} className="grid gap-4">
        <h3 className="font-semibold">{group === "inputs" ? "Insumos" : "Productos obtenidos"}</h3>
        {order[group].map(line => {
          const balance = c.data.balances?.find(b => b.inventoryItemId === line.inventoryItemId);
          const amount = actual[line.inventoryItemId];
          const valid = positiveQuantity.safeParse(amount).success;
          const outputCost = preview?.outputs.find(row => row.id === line.inventoryItemId);
          return <div key={line.inventoryItemId} className="grid gap-3 border-b border-outline pb-4">
            <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_10rem_7rem]">
              <p>{line.inventoryItemName}<span className="block text-xs text-muted">{line.inventoryItemSku || "Sin SKU"}</span></p>
              <Field label={"Cantidad · " + unit(line.baseUnit, "2")} value={actual[line.inventoryItemId]}
                onChange={value => setActual(previous => ({ ...previous, [line.inventoryItemId]: value }))} decimal />
              {"costAllocationPercentage" in line && <div><p className="text-xs text-muted">Costo %</p><p>{percentage(line.costAllocationPercentage)}</p></div>}
            </div>
            <p className="text-xs leading-6 text-muted">
              Planificada: {quantity(line.plannedQuantity, line.baseUnit)} · Diferencia: {valid ? quantity(subtract(amount, line.plannedQuantity), line.baseUnit) : "—"} · {group === "inputs" ? "Disponible" : "Existencia actual"}: {balance ? quantity(balance.currentStock, line.baseUnit) : "Se validará al confirmar"} · Costo promedio: {balance ? cost(balance.averageUnitCost, line.baseUnit, c.currency) : "Sin valoración"}
              {group === "inputs" ? <> · Costo consumido estimado: {cash(preview?.inputs.find(row => row.id === line.inventoryItemId)?.actual ?? null, c.currency)}</>
                : <> · Costo asignado estimado: {cash(outputCost?.value ?? null, c.currency)} · Costo unitario resultante estimado: {cost(outputCost?.unitCost ?? null, line.baseUnit, c.currency)}</>}
            </p>
          </div>;
        })}
      </section>)}
    </>)}
    {step === 2 && <>
      {isWaste && <p>Motivo: {reason}</p>}
      <Records label="Revisión antes de confirmar" rows={reviewRows} />
      <Metrics rows={isWaste ? [{ label: "Costo estimado del desperdicio", value: cash(wasteTotal, c.currency) }] : [
        { label: "Costo estimado de insumos", value: cash(preview?.total ?? null, c.currency) },
        { label: "Costo esperado al promedio actual", value: cash(preview?.expected ?? null, c.currency) },
        { label: "Variación estimada de costo", value: cash(preview?.difference ?? null, c.currency) },
        { label: "Desperdicio registrado por separado", value: cash(c.data.performance.summary.declaredWasteCost, c.currency) },
        { label: "Valor estimado que ingresa a inventario", value: cash(preview?.total ?? null, c.currency) },
      ]} />
      {!isWaste && <Records label="Rendimiento por producto" rows={order.outputs.map(line => ({ id: line.inventoryItemId, fields: [
        { label: "Producto obtenido", value: line.inventoryItemName },
        { label: "Rendimiento", value: percentage(divide(multiply(actual[line.inventoryItemId], "100"), line.plannedQuantity)) },
      ] }))} />}
      <Notice>Los costos mostrados son estimaciones. La API usa el stock y el costo vigente al confirmar.</Notice>
      <Warning>{isWaste ? "Este desperdicio afectará inmediatamente las existencias y su valor." : "Se descontarán los insumos reales y se ingresarán los productos obtenidos. El desperdicio se registra por separado."} Una vez confirmada, esta operación no se puede deshacer desde esta pantalla.</Warning>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="size-5 accent-orange-500" />Confirmo las cantidades y la aplicación al inventario.</label>
    </>}
  </Frame>;
}
