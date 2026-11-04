# Validaciones y recuperación de transferencias

Documento Word propuesto: **21 - Validaciones y recuperación de transferencias.docx**  
Carpeta: **Inventario-producción / Administrador**  
Estado: **Borrador pendiente de prueba y evidencias**

## ¿Para qué sirve?

Evita registrar traslados con ubicaciones incorrectas, artículos repetidos, cantidades inválidas o stock insuficiente. También orienta al usuario cuando el servidor rechaza la operación o no se puede confirmar el resultado.

## Ejemplo: cantidad superior a la disponible

Si el origen tiene 2 croissants e intentas transferir 3, el formulario debe advertir que la cantidad supera la existencia disponible y bloquear la revisión.

Este ejemplo debe hacerse antes de transferir todo el saldo. Si el origen ya está agotado, utilizar otro artículo con stock real o probar desde una ubicación que tenga existencias.

### 1. Consultar la disponibilidad real

Abrir Nueva transferencia y seleccionar el origen. Seleccionar un artículo activo y valorado.

[Insertar imagen 1: artículo con su existencia disponible.]

### 2. Intentar una cantidad superior

Ingresar una cantidad mayor al saldo disponible. Revisar el mensaje y el estado del botón. No debe enviarse la operación.

[Insertar imagen 2: validación de stock insuficiente y botón deshabilitado.]

### 3. Corregir el dato

Ingresar una cantidad válida. Completar el motivo y el destino; el formulario debe permitir revisar. Cancelar el ejercicio si solo se está verificando la validación.

[Insertar imagen 3: cantidad corregida y revisión disponible.]

## Otras validaciones

| Acción | Resultado esperado |
|---|---|
| Cantidad vacía, cero o negativa | No permite revisar. |
| Texto o más de tres decimales | Muestra validación y no permite continuar. |
| Origen igual al destino | No se ofrece como destino válido. |
| Seleccionar un artículo en dos líneas | No está disponible en la segunda línea. |
| Eliminar todas las líneas | Solicita agregar al menos un artículo. |
| Artículo inactivo o sin existencia | No está disponible como opción transferible. |
| Artículo sin valoración | Se identifica y queda deshabilitado; costo null no se convierte en cero. |
| Motivo menor de tres caracteres | No permite revisar. |
| Referencia o notas demasiado largas | Campos limitados según el contrato. |
| No marcar confirmación | Completar transferencia permanece deshabilitado. |
| Volver al formulario y revisar nuevamente | Solicita confirmar de nuevo. |
| Cerrar con cambios | Solicita confirmar el descarte. |

[Insertar imagen 4: ejemplo de cantidad inválida.]

[Insertar imagen 5: artículo sin valoración, si existe un caso preparado.]

[Insertar imagen 6: confirmación obligatoria en el segundo paso.]

[Insertar imagen 7: aviso al descartar cambios.]

## Si la existencia cambia durante el proceso

Otro usuario puede consumir o transferir inventario después de que se consultó el saldo. Si el servidor rechaza el intento con un conflicto:

1. Leer el mensaje.
2. Esperar la nueva consulta de saldos.
3. Revisar el origen y las cantidades conservadas.
4. Corregir los datos.
5. Volver a revisar y confirmar.

No se muestra éxito ni se descuentan saldos localmente antes de la respuesta del servidor.

[Insertar imagen 8: conflicto controlado y datos conservados.]

[Insertar imagen 9: disponibilidad actualizada después del conflicto.]

## Si el resultado no puede confirmarse

Una pérdida de conexión, un error del servidor o una respuesta inválida pueden dejar incierto el resultado mostrado en pantalla.

1. Cerrar el modal.
2. Consultar Movimientos por referencia, fecha y artículo.
3. Comprobar Existencias de origen y destino.
4. Si aparecen los movimientos, consultar sus detalles y no repetir el registro.
5. Si la consulta también falla o el resultado sigue siendo incierto, resolver la consulta antes de repetir.
6. Solo iniciar un nuevo intento cuando se haya verificado que la operación no quedó registrada.

El modal no permite reenviar automáticamente en este estado. La referencia externa no evita duplicaciones por sí sola.

[Insertar imagen 10: aviso de resultado no confirmado en entorno de prueba.]

[Insertar imagen 11: comprobación posterior en Movimientos y Existencias.]

## Si el error ocurre al consultar

El botón **Reintentar consulta** vuelve a cargar ubicaciones o saldos. Una consulta no modifica inventario.

[Insertar imagen 12: error de consulta y acción de reintento.]

## Si cambia el permiso o vence la sesión

No se permite continuar creando transferencias. Leer el mensaje de acceso denegado o sesión inválida y entrar nuevamente con una cuenta autorizada cuando corresponda.

## Registro de validación

Pruebas ejecutadas: pendiente.  
Fecha / usuario: pendiente.  
Resultados obtenidos: pendiente.  
Solicitudes enviadas durante validaciones locales: pendiente, esperado cero.  
Movimientos creados durante validaciones rechazadas: pendiente, esperado cero.  
Estado: pendiente.  
Observaciones: pendiente.
