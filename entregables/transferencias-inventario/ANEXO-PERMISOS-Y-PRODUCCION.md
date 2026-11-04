# Incorporación de transferencias a la documentación existente

Estado: borrador pendiente de pruebas de interfaz.

## Documento 00 — Funciones y permisos del módulo

Agregar la función **Transferir existencias entre ubicaciones**.

Propósito: redistribuir inventario y su valor entre ubicaciones del negocio. Ejemplo: enviar 2 croissants desde la planta al punto de venta sin generar una venta ni una nueva producción.

| Rol | Crear transferencia | Consultar |
|---|---|---|
| ADMIN | Sí | Movimientos, detalle, Existencias y Kardex según las pantallas administrativas actuales. |
| PRODUCTION | No | Existencias de su ámbito y las consultas que ya tenga autorizadas. Esta integración no amplía permisos. |
| Otros roles | No | Se mantienen sus permisos actuales. |

[Insertar imagen 1: acción Nueva transferencia visible para ADMIN.]

[Insertar imagen 2: pantalla de inventario permitida para PRODUCTION, sin acción de crear transferencia.]

## Producción / 01 — Consultar existencias

Agregar el apartado **Cambios de existencias por transferencias**.

Cuando un administrador envía producto terminado desde la planta a otra ubicación, la existencia de la planta disminuye. La producción registrada, su receta y la orden conservan su historial: un traslado no significa que se haya producido menos.

Ejemplo: la planta tiene 2 croissants y se trasladan ambos al punto de venta. La planta queda con 0 y el destino con 2. El historial de la producción original continúa disponible según permisos.

Pasos:

1. Consultar el artículo en la planta antes de la transferencia.
2. Después del traslado administrativo, consultar nuevamente el saldo.
3. Comprobar que la consulta usa la ubicación asignada.
4. Verificar que no aparece una nueva orden o producción causada por el traslado.

[Insertar imagen 3: existencia de la planta antes del traslado.]

[Insertar imagen 4: existencia actualizada de la planta después del traslado.]

[Insertar imagen 5: historial de producción conservado.]

## Administrador / 17 — Kardex y costos

Agregar **Transferencias internas** al catálogo de tipos consultables.

Cada traslado genera una salida y una entrada, cada una con su ubicación y saldo resultante. Ambas conservan el valor trasladado y pueden identificarse mediante el detalle del movimiento.

[Insertar imagen 6: salida y entrada en Kardex.]

[Insertar imagen 7: detalle con Transferencia #id.]

## Administrador / 18 — Auditoría de inventario

Agregar **Efecto de una transferencia sobre los saldos comparados**.

Una transferencia conserva la suma de cantidades por ubicaciones para cada artículo. No corrige automáticamente un saldo global heredado desactualizado.

Ejemplo: global heredado 22, suma de ubicaciones 2. Antes: planta 2, punto de venta 0. Después: planta 0, punto de venta 2. La suma sigue siendo 2 y el descuadre histórico puede seguir siendo 20.

[Insertar imagen 8: comparación de auditoría antes y después de la transferencia.]

## Ventas — seguimiento pendiente

La disponibilidad del producto comercial debe obtenerse de su ubicación de venta y de sus vínculos de inventario. No debe interpretarse el saldo global heredado como disponibilidad local.

El catálogo actual de Ventas no expone una cantidad por ubicación. La prueba TR-033 debe mantenerse pendiente de integrar ese contrato. Actualizar el catálogo no prueba por sí solo que la pantalla muestra el saldo local correcto.

## Control de actualización

Fecha: pendiente.  
Responsable: pendiente.  
Documentos actualizados: pendiente.  
Pruebas que sustentan cada apartado: pendiente.  
Evidencias agregadas: pendiente.
