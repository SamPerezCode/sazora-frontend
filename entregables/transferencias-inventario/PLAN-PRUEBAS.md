# Plan pendiente — transferencias de inventario

Fecha de preparación: 04/11/2026.
Estado de las pruebas manuales: PENDIENTE. Las comprobaciones automatizadas del código no equivalen a aprobar los ejercicios de usuario.

## Orden de ejecución

1. Aplicar el código y comprobar compilación.
2. Catálogos, formulario y validaciones sin registrar movimientos.
3. Transferencia completa de 2 croissants, si se confirman los saldos iniciales indicados abajo.
4. Consulta de salida/entrada y comprobación de saldos, valores, Kardex y auditoría.
5. Transferencias parcial, decimal, múltiple y a un destino con saldo previo, usando una nueva captura de saldos antes de cada prueba.
6. Errores controlados, concurrencia, navegación, móvil y permisos de consulta.
7. Actualización de otras pantallas, persistencia y revisión de informes pendientes.

Las validaciones de cantidad superior al saldo deben probarse ANTES de transferir completamente el origen. Después de transferirlo, ese artículo ya no tendrá saldo disponible en ese origen.

## Preparación del primer ejercicio

| Dato | Valor que debe verificarse |
|---|---|
| Usuario | ADMIN |
| Artículo | Croissant Producción · PP-001 |
| Origen | MAIN · PLANT-01 |
| Destino | Punto de venta principal · PS-001, si existe y está habilitado |
| Existencia origen | 2 unidades |
| Existencia destino | 0 unidades |
| Cantidad | 2 unidades |
| Costo promedio origen | Aproximadamente 911,11 por unidad; usar la precisión de la API |
| Valor previsto | Aproximadamente 1.822,22 |
| Referencia | traslado-001, o una nueva si ya se utilizó en un ejercicio anterior |
| Motivo | Abastecimiento del punto de venta principal |

No crear stock ficticio para hacer coincidir esta tabla. Si los datos actuales difieren, registrar los valores reales y recalcular el resultado esperado antes de confirmar.

[Insertar imagen 1: existencia y costo del croissant en origen antes de transferir.]
[Insertar imagen 2: existencia del mismo artículo en destino antes de transferir.]

## Casos de aceptación

Se conservan los códigos del plan adjunto. Todos están pendientes de ejecución manual o de evidencia de integración, salvo las comprobaciones unitarias descritas en README.

| Código | Verificación | Resultado esperado / ejecución |
|---|---|---|
| TR-001 | Botón por rol | ADMIN lo ve; PRODUCTION no tiene la acción. UI. |
| TR-002 | Protección del endpoint | 403 para PRODUCTION; sin movimientos. Evidencia backend; no repetir mediante peticiones manuales en el recorrido de UI. |
| TR-003 | Catálogo de ubicaciones | Solo negocio actual, activas y habilitadas; origen excluido del destino. |
| TR-004 | Saldo del origen | Cantidad, SKU, unidad y costo corresponden a la ubicación elegida, nunca al saldo global heredado. |
| TR-005 | Cambiar origen | Reinicia las líneas y carga saldos del nuevo origen. |
| TR-006 | Transferencia completa | 2 unidades: origen 2→0 y destino 0→2; resultado exitoso con identificadores reales. |
| TR-007 | Transferencia parcial | Con saldo inicial S y cantidad Q<S: origen S−Q y destino D+Q. |
| TR-008 | Cantidades decimales | Ejemplo 2,5 kg; envío como cadena con punto, máximo tres decimales. |
| TR-009 | Varios artículos | Tres artículos distintos; una transferencia, dos movimientos, todas las líneas. |
| TR-010 | Conservación del valor | Valor de salida igual al de entrada; impacto consolidado cero. Comparar precisión de API y formato visible. |
| TR-011 | Artículo sin valoración | Se identifica y queda deshabilitado; null no se muestra como costo cero. |
| TR-012 | Destino con saldo previo | Nuevo saldo y promedio del backend. Ejemplo independiente: 3×1.000 + 2×800 = 4.600; 5 unidades, promedio 920. |
| TR-013 | Origen igual al destino | No es seleccionable; ninguna solicitud inválida desde UI. |
| TR-014 | Cantidad superior al saldo | Error y revisión deshabilitada; no se crea movimiento. |
| TR-015 | Cero, negativa, texto, vacío, >3 decimales | No permite continuar ni enviar. |
| TR-016 | Artículos repetidos | El artículo seleccionado no está disponible en otra línea. |
| TR-017 | Sin artículos | Mensaje para agregar artículo y revisión deshabilitada. |
| TR-018 | Ubicación inactiva/no habilitada manipulada | Validación de backend; mantener evidencia de integración existente. En UI comprobar exclusión del catálogo. |
| TR-019 | Artículo inactivo/sin saldo | No está disponible como transferible. |
| TR-020 | Confirmación | Casilla obligatoria; volver al formulario exige confirmar otra vez. |
| TR-021 | Doble clic | Una solicitud POST, una transferencia y dos movimientos; botón bloqueado durante envío. |
| TR-022 | Conflicto durante envío | No anuncia éxito; conserva datos y consulta saldos de nuevo ante 409. |
| TR-023 | Atomicidad | Salida y entrada juntas o ninguna. Requiere evidencia backend/integración; la UI no demuestra rollback interno. |
| TR-024 | Fila de salida | Origen, cantidad negativa, valor negativo, referencia y estado Completada. |
| TR-025 | Fila de entrada | Destino, cantidad positiva, valor positivo, referencia y estado Completada. |
| TR-026 | Relación y detalle | Ambas filas con Transferencia #id; botones abren M-salida y M-entrada correctos. |
| TR-027 | Filtro por ubicación | Origen muestra salida, destino entrada y Todas ambas. |
| TR-028 | Búsqueda/filtros | Transferencia, referencia, responsable, fechas, artículo y ubicación. Dos filas por transferencia son correctas, no duplicaciones. |
| TR-029 | Existencias | Actualizan saldos, estados físicos y valores de ambas ubicaciones. |
| TR-030 | Resumen | Conserva valor consolidado; cambia distribución por ubicación. No sumar cantidades de unidades diferentes. |
| TR-031 | Kardex | Salida/entrada coherentes, saldos y costos; detalle permite identificar Transferencia #id. |
| TR-032 | Auditoría de inventario | Suma por ubicaciones se conserva. No crea diferencias nuevas ni corrige diferencias heredadas. |
| TR-033 | Disponibilidad local en ventas | PENDIENTE DE CONTRATO: catálogo actual no devuelve cantidades por ubicación. Verificar luego producto vinculado y disponibilidad real local. |
| TR-034 | Producción | Disminuye stock de la planta; receta, orden y producción anterior conservan su historial. |
| TR-035 | Caja/ventas/facturación | No crea caja, venta, pedido, factura, impuestos, ingreso o gasto. |
| TR-036 | Informes | Movimiento interno; no suma a compras, producción, desperdicio, consumo o ventas. |
| TR-037 | Actualización | Consultas montadas se actualizan y las otras pantallas cargan datos actuales al abrirse, sin F5. Ventas: alcance limitado según TR-033. |
| TR-038 | Persistencia | Tras recargar se mantienen transferencia, movimientos y saldos. |
| TR-039 | Dos administradores | No se admite consumir dos veces el mismo saldo. Segundo intento se bloquea al actualizar o recibe 409; sin negativos. |
| TR-040 | Formatos | Fecha local, moneda del negocio, costos con dos decimales, cantidades hasta tres, unidades y signos. |
| TR-041 | Estados y recuperación | Carga, vacío explicado, consulta fallida con reintento, envío y éxito. Error incierto exige revisar estado antes de repetir. |
| TR-042 | Navegación y teclado | Anterior conserva datos, descarte confirmado, Escape y foco del modal, controles accesibles por teclado. |
| TR-043 | Longitudes y motivo | Motivo obligatorio 3–500; referencia 0–120; nota de línea 0–500. Añadido por contrato real. |
| TR-044 | Diseño adaptable | Escritorio, tableta y móvil; claro/oscuro; cuerpo del modal desplazable y acciones accesibles. |

## Errores controlados y pruebas especiales

- Un error local de cantidad no requiere provocar un 500.
- Un 409 real puede probarse con dos sesiones autorizadas y datos de prueba, consumiendo primero el saldo desde una de ellas.
- Pérdida de respuesta y error de servidor deben probarse en entorno de prueba. Antes de repetir, consultar Movimientos y saldos: que el navegador falle no demuestra que el servidor haya revertido.
- Las pruebas directas de autorización y atomicidad pertenecen al backend. Registrar la evidencia existente; no marcarlas aprobadas por ocultar el botón.
- No usar identificadores 146/147 de las imágenes de demostración; anotar los devueltos por la API.
- La referencia externa no es una clave de idempotencia y no garantiza protección contra un segundo registro.

## Registro por prueba

| Campo | Valor |
|---|---|
| Código | TR-___ |
| Usuario / rol | Por completar |
| Fecha y hora | Por completar |
| Datos iniciales | Origen, destino, artículo, cantidades y valores reales |
| Acción | Por completar |
| Resultado esperado | Por completar antes de ejecutar |
| Resultado obtenido | Por completar |
| Estado | Pendiente / Aprobada / Fallida / Bloqueada |
| Evidencia | Capturas y, cuando aplique, solicitud/respuesta sin credenciales |
| Observaciones | Por completar |

## Documentos que deben incorporarse

- `Administrador/19 - Transferir existencias entre ubicaciones.docx`
- `Administrador/20 - Consultar transferencias y sus movimientos.docx`
- `Administrador/21 - Validaciones y recuperación de transferencias.docx`
- Actualizar `00 - Funciones y permisos del módulo.docx`.
- Actualizar `Producción/01 - Consultar existencias.docx`.
- Agregar las referencias a transferencias en `Administrador/17 - Kardex y costos.docx` y `Administrador/18 - Auditoría de inventario.docx`.

Los nombres son destinos propuestos para Word; los archivos entregados aquí son Markdown con el contenido y los espacios para imágenes.

## Continuidad de las pruebas anteriores

- Conservar la documentación ya validada de compras, ajustes, devoluciones, recetas, órdenes y producción rápida.
- Completar la comprobación final del cambio de Conciliación a Auditoría y sus textos (INV-042), si todavía está pendiente.
- Retomar Informes (INV-043) después de transferencias, incluyendo la exclusión de traslados de los totales de compras, producción, desperdicio y ventas.
- La funcionalidad no se declara aprobada hasta validar el flujo real y resolver o registrar expresamente los casos bloqueados.
