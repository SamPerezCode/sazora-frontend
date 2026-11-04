# Transferencias de inventario — código e integración

Estado: propuesta preparada y comprobada; pendiente de aplicar y probar en la interfaz.
Fecha de preparación: 04/11/2026.

El código completo está en [transferencias.patch](transferencias.patch). El parche crea tres archivos y modifica ocho archivos existentes. Los archivos de aplicación todavía no se han modificado.

## Aplicar el código

Desde la raíz de `sazora-web`, ejecutar primero:

```powershell
git apply --check --whitespace=error entregables/transferencias-inventario/transferencias.patch
```

Si termina sin errores, aplicar:

```powershell
git apply entregables/transferencias-inventario/transferencias.patch
```

Luego verificar:

```powershell
node entregables/transferencias-inventario/verificar-transferencias.mjs
npm run build
```

No requiere instalar dependencias. Si la comprobación del parche informa conflictos, revisar las diferencias antes de aplicarlo: fue preparado sobre los archivos presentes el 04/11/2026.

## Archivos de aplicación

| Archivo | Cambio |
|---|---|
| [InventoryTransferDialog.tsx](../../src/features/inventory/components/InventoryTransferDialog.tsx) | Nuevo formulario de dos pasos, validación, confirmación, resultado y acceso a los movimientos. |
| [inventory-transfer.service.ts](../../src/features/inventory/services/inventory-transfer.service.ts) | Contratos Zod/TypeScript, catálogo, saldos locales, vista previa y POST. |
| [inventory-invalidation.ts](../../src/lib/inventory-invalidation.ts) | Notificación de actualización por negocio. |
| [InventoryMovementList.tsx](../../src/features/inventory/components/InventoryMovementList.tsx) | Acción ADMIN, referencias, sentido, contraparte y valores con signo. |
| [InventoryMovementDetail.tsx](../../src/features/inventory/components/InventoryMovementDetail.tsx) | Identificador de transferencia y sentido del movimiento. |
| [inventory-audit.schema.ts](../../src/features/inventory/schemas/inventory-audit.schema.ts) | TRANSFER y metadatos sourceType/sourceId. |
| [inventory-audit.ts](../../src/features/inventory/utils/inventory-audit.ts) | Etiqueta Transferencia para Movimientos y Kardex. |
| [inventory-operations.ts](../../src/features/inventory/services/inventory-operations.ts) | Compatibilidad del contrato anterior de movimientos con TRANSFER. |
| [inventory-workspace.ts](../../src/features/inventory/services/inventory-workspace.ts) | Etiquetas legibles de las referencias de transferencias. |
| [useInventoryQuery.ts](../../src/features/inventory/hooks/useInventoryQuery.ts) | Actualización de las consultas de inventario montadas. |
| [useSales.ts](../../src/features/sales/hooks/useSales.ts) | Actualización de las consultas existentes de Ventas, respetando una operación en curso. |

Los enlaces a los tres archivos nuevos estarán disponibles después de aplicar el parche.

## Comportamiento incluido

- Botón Nueva transferencia exclusivo de ADMIN, con una segunda comprobación en el servicio.
- Ubicaciones reales, activas, del negocio y habilitadas para inventario.
- Saldo y costo de la ubicación de origen; selección sin duplicados.
- Cantidades positivas de hasta tres decimales; el campo acepta coma decimal y la convierte en punto para enviarla.
- Entre 1 y 100 artículos; referencia opcional hasta 120 caracteres; notas de línea opcionales hasta 500.
- Motivo obligatorio de 3 a 500 caracteres: el esquema real del backend lo exige, aunque el texto adjunto lo describía como opcional.
- No se envía costo unitario; el backend determina la valoración definitiva.
- Revisión, casilla obligatoria, bloqueo de doble clic y estado de envío.
- Resultado con identificadores reales de transferencia y movimientos.
- Dos filas relacionadas por sourceId, con salida negativa y entrada positiva.
- Tema claro/oscuro, formulario adaptable y registros en tarjetas en pantallas pequeñas.
- Formato monetario de dos decimales, sin reducir la precisión usada para calcular o recibir valores.
- Un error 409 conserva los datos y vuelve a consultar los saldos.
- Ante pérdida de respuesta, error 5xx o respuesta inválida, no se permite reenviar desde ese modal: primero debe revisarse si la operación quedó registrada.
- Cerrar un formulario con cambios pide confirmar el descarte.

## Contratos utilizados

- GET /api/locations
- GET /api/inventory-items/location-balances?locationId=<origen>
- POST /api/inventory-movements/transfers
- GET /api/inventory-movements
- GET /api/inventory-movements/<movimiento>

No existen consultas específicas GET de transferencias. El resultado inicial procede del POST; las consultas posteriores utilizan los movimientos. No se guardan datos de demostración.

## Actualización de consultas

Al confirmar una respuesta válida se notifica al negocio actual. Las consultas montadas de useInventoryQuery vuelven a cargar saldos, resumen, movimientos, Kardex, auditoría y consultas de Producción. Las pantallas desmontadas consultan al abrirse.

Ventas vuelve a solicitar sus datos existentes. Esta notificación es local a la instancia de la aplicación: no sustituye los eventos del servidor para otros dispositivos o sesiones.

## Limitaciones verificadas

1. La consulta actual de productos de Ventas no incluye cantidades disponibles por ubicación. Se actualiza su catálogo existente, pero no es posible afirmar que mostrará “2 disponibles” sin integrar un contrato autorizado de disponibilidad local. TR-033 queda pendiente de ese contrato; no se utiliza current_stock global para simular disponibilidad.
2. “Enviada a” y “Recibida desde” se completan cuando ambos movimientos están en el listado recibido. Si la contraparte no está disponible, se conserva el sentido y Transferencia #id sin inventar una ubicación.
3. La vista previa usa el costo consultado; la confirmación muestra los valores definitivos del backend. Otro movimiento puede modificar la valoración entre consulta y registro.
4. Una transferencia no corrige el saldo global heredado ni diferencias históricas de auditoría.
5. Las capturas de Lovable son referencia visual. Los identificadores de esas capturas no se reutilizan como datos reales.

## Comprobaciones realizadas

- TypeScript del proyecto con la propuesta: 0 diagnósticos.
- ESLint de los 11 archivos propuestos: sin errores ni advertencias.
- Build Vite de la propuesta: correcto, 2364 módulos transformados. Se compiló mediante sustituciones en memoria, sin escribir src ni dist.
- 36 comprobaciones de contrato y lógica: aprobadas, con transporte simulado y sin peticiones a la API real.
- git apply --check --whitespace=error: correcto sobre el estado actual.
- Pruebas visuales y flujo completo con el backend real: pendientes.
- Atomicidad y concurrencia transaccional del servidor: no demostradas por las pruebas del frontend.

## Pruebas y documentación

- [PLAN-PRUEBAS.md](PLAN-PRUEBAS.md): casos TR-001 a TR-044 y pruebas anteriores pendientes.
- [19-Transferir-existencias.md](19-Transferir-existencias.md): manual ADMIN, con imágenes por paso.
- [20-Consultar-transferencias.md](20-Consultar-transferencias.md): consulta, trazabilidad y comprobación de saldos.
- [21-Validaciones-transferencias.md](21-Validaciones-transferencias.md): validaciones, errores y recuperación.
- [ANEXO-PERMISOS-Y-PRODUCCION.md](ANEXO-PERMISOS-Y-PRODUCCION.md): actualización de documentos existentes.
- [verificar-transferencias.mjs](verificar-transferencias.mjs): comprobaciones reproducibles tras aplicar el código.

Los manuales son borradores hasta que la prueba correspondiente sea confirmada. Completar resultado obtenido, fecha y evidencias después de cada prueba.
