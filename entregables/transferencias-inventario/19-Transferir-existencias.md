# Transferir existencias entre ubicaciones

Documento Word propuesto: **19 - Transferir existencias entre ubicaciones.docx**  
Carpeta: **Inventario-producción / Administrador**  
Rol: **ADMIN**  
Estado: **Borrador pendiente de prueba y evidencias**

## ¿Para qué sirve?

Permite enviar inventario existente de una ubicación a otra. Por ejemplo, trasladar dos croissants desde la planta MAIN al punto de venta para que queden registrados allí.

El traslado descuenta la cantidad del origen e ingresa la misma cantidad en destino, conservando el valor trasladado. No constituye una compra, una venta ni una nueva producción.

## Ejemplo del ejercicio

Artículo: Croissant Producción, SKU PP-001.  
Origen: MAIN · PLANT-01.  
Destino: Punto de venta principal · PS-001.  
Cantidad: 2 unidades.  
Referencia: traslado-001.  
Motivo: Abastecimiento del punto de venta principal.

Antes de ejecutar, confirmar que el origen tiene 2 unidades y el destino 0. El valor esperado aproximado es 1.822,22, usando el costo real de origen y su precisión interna.

## Requisitos

- Usuario ADMIN.
- Dos ubicaciones distintas, activas y habilitadas para inventario.
- Artículo activo, con existencia suficiente y valoración en el origen.
- Motivo de 3 a 500 caracteres.
- Una o más líneas, máximo 100, sin repetir artículos.

## Procedimiento

### 1. Consultar los saldos iniciales

Entrar en Inventario → Existencias. Consultar el artículo en origen y después en destino. Anotar cantidades, costo promedio y valor. No utilizar el saldo global heredado de Auditoría como disponibilidad del origen.

[Insertar imagen 1: croissant en MAIN antes de transferir, mostrando 2 unidades y su valoración.]

[Insertar imagen 2: croissant en el punto de venta antes de transferir, mostrando el saldo inicial.]

### 2. Abrir Nueva transferencia

Entrar en Inventario → Movimientos y seleccionar **Nueva transferencia**.

[Insertar imagen 3: pantalla de Movimientos con el botón Nueva transferencia.]

### 3. Seleccionar las ubicaciones y escribir el motivo

Seleccionar MAIN como origen y el punto de venta como destino. Escribir la referencia y el motivo del ejercicio.

El origen no puede elegirse como destino. Si se cambia el origen, se reinician las líneas para consultar el inventario de la nueva ubicación.

[Insertar imagen 4: ubicaciones, referencia y motivo diligenciados.]

### 4. Agregar el artículo y la cantidad

Seleccionar Croissant Producción e ingresar 2. Revisar el SKU, la unidad base, las existencias disponibles, el costo promedio del origen y el valor previsto.

Las notas de línea son opcionales. **Agregar artículo** permite incluir otros artículos distintos. Una cantidad con decimales admite hasta tres posiciones.

[Insertar imagen 5: línea del croissant con cantidad 2 y vista previa del valor trasladado.]

### 5. Revisar la transferencia

Pulsar **Revisar transferencia**. Comprobar origen, destino, referencia, motivo, responsable, líneas y total.

Los costos son una estimación basada en la consulta del origen. El backend calcula los valores definitivos al confirmar.

[Insertar imagen 6: paso 2 con el resumen completo y la casilla todavía desmarcada.]

### 6. Confirmar y completar

Leer el aviso, marcar **Confirmo las ubicaciones, los artículos y las cantidades de esta transferencia** y pulsar **Completar transferencia**.

El botón queda bloqueado durante el envío. La operación afecta inmediatamente los saldos cuando el servidor la registra.

[Insertar imagen 7: confirmación marcada y botón habilitado.]

### 7. Revisar el resultado

El sistema debe mostrar **Transferencia #<id> completada**, origen y destino, identificadores de salida y entrada, número de líneas, valor definitivo, responsable y fecha.

Registrar los identificadores reales. Los números de las imágenes de diseño son ejemplos.

[Insertar imagen 8: confirmación exitosa con la transferencia y sus dos movimientos.]

### 8. Comprobar el inventario

Consultar Existencias en ambas ubicaciones. Para los saldos iniciales del ejemplo:

| Ubicación | Antes | Movimiento | Después |
|---|---:|---:|---:|
| MAIN · PLANT-01 | 2 unidades | −2 | 0 unidades |
| Punto de venta principal · PS-001 | 0 unidades | +2 | 2 unidades |
| Total entre ubicaciones | 2 unidades | 0 | 2 unidades |

[Insertar imagen 9: existencia final del origen.]

[Insertar imagen 10: existencia final del destino.]

## Resultado esperado

- Una transferencia completada y dos movimientos relacionados.
- Misma cantidad que sale e ingresa por artículo.
- Mismo valor trasladado en salida y entrada.
- Ninguna venta, compra, producción, factura ni movimiento de caja generado por el traslado.
- Los saldos se mantienen después de recargar.
- El costo promedio del destino lo determina el backend; puede cambiar si ya tenía inventario.

## Precaución operativa

Si aparece un mensaje indicando que el resultado no está confirmado, consultar Movimientos y Existencias antes de registrar otra transferencia. Un fallo de respuesta no garantiza que la operación no se haya guardado.

## Registro de validación

Fecha: pendiente.  
Usuario: pendiente.  
Transferencia: pendiente.  
Movimiento de salida: pendiente.  
Movimiento de entrada: pendiente.  
Resultado obtenido: pendiente.  
Estado: pendiente.  
Observaciones: pendiente.
