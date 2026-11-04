# Consultar transferencias y sus movimientos

Documento Word propuesto: **20 - Consultar transferencias y sus movimientos.docx**  
Carpeta: **Inventario-producción / Administrador**  
Estado: **Borrador pendiente de prueba y evidencias**

## ¿Para qué sirve?

Permite identificar de dónde salió un artículo, a dónde llegó y qué cantidad y valor se trasladaron. Sirve para comprobar abastecimientos y revisar diferencias entre ubicaciones.

Una transferencia tiene dos movimientos: salida en el origen y entrada en el destino. Ver dos filas con el mismo identificador de transferencia es correcto.

## Ejemplo

Consultar el traslado de 2 croissants registrado en el ejercicio anterior, usando su referencia real y el identificador devuelto por el sistema.

## Procedimiento

### 1. Consultar ambas filas

En Inventario → Movimientos, seleccionar **Todas las ubicaciones**, filtrar por **Transferencia** y buscar la referencia del ejercicio.

Las dos filas deben mostrar **Transferencia #<mismo id>**. Una corresponde a la salida y otra a la entrada.

[Insertar imagen 1: ambas filas de la transferencia y su referencia.]

### 2. Revisar la salida

La fila de MAIN debe mostrar la cantidad con signo negativo y el valor descontado. Abrir **Ver detalle** y comprobar cantidad, saldo anterior, saldo resultante, costo y número de transferencia.

[Insertar imagen 2: detalle del movimiento de salida.]

### 3. Revisar la entrada

La fila del punto de venta debe mostrar la cantidad con signo positivo y el valor recibido. Abrir su detalle y comprobar los mismos datos.

El valor de esta entrada debe coincidir con el valor de la salida.

[Insertar imagen 3: detalle del movimiento de entrada.]

### 4. Comprobar los filtros por ubicación

Seleccionar el origen: debe aparecer la salida. Seleccionar el destino: debe aparecer la entrada. Volver a Todas las ubicaciones: deben aparecer ambas.

[Insertar imagen 4: filtro de origen con la salida.]

[Insertar imagen 5: filtro de destino con la entrada.]

### 5. Consultar Kardex y costos

Seleccionar el artículo, las fechas del ejercicio y cada ubicación. Revisar la salida, la entrada y los saldos resultantes. Abrir el detalle para consultar el identificador de transferencia.

[Insertar imagen 6: Kardex del artículo en origen.]

[Insertar imagen 7: Kardex del artículo en destino.]

### 6. Revisar Resumen y Auditoría

En Resumen, comprobar que el valor se redistribuye entre ubicaciones y no aumenta el valor total del negocio por el traslado.

En Auditoría de inventario, comprobar que la suma de ubicaciones del artículo se conserva. Una diferencia anterior con el saldo global heredado puede continuar: esta operación no la corrige.

Ejemplo: si antes el global heredado era 22 y las ubicaciones sumaban 2, trasladar esas 2 unidades mantiene la suma por ubicaciones en 2. No debe crearse stock adicional para compensar las 20 unidades de diferencia histórica.

[Insertar imagen 8: resumen posterior por ubicación.]

[Insertar imagen 9: auditoría del artículo, comparada con la evidencia anterior.]

### 7. Comprobar persistencia

Recargar el navegador y repetir la consulta por referencia. Los dos movimientos, las cantidades y los valores deben mantenerse.

[Insertar imagen 10: transferencia consultada después de recargar.]

## Resultado esperado

- Trazabilidad entre transferencia, salida y entrada.
- Cantidades y valores coincidentes.
- Impacto económico consolidado cero.
- Ubicaciones y signos correctos.
- Sin nuevas diferencias de saldos causadas por el traslado.
- Información persistente después de recargar.

## Registro de validación

Fecha: pendiente.  
Referencia: pendiente.  
Transferencia: pendiente.  
Salida / entrada: pendiente.  
Saldos comprobados: pendiente.  
Valor comprobado: pendiente.  
Estado: pendiente.  
Observaciones: pendiente.
