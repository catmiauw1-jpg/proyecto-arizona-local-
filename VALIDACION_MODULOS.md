# Validacion de fidelidad contra Excel

Fuente de verdad: `4.0 CONFINAMIENTO ARIZONA.xlsm`.

Regla aplicada en esta revision:

- Celda amarilla del Excel = campo editable amarillo en la app.
- Celda no amarilla = campo bloqueado, resultado calculado o dato no editable.
- Si una formula no esta replicada celda por celda, se marca como pendiente.

## ADAPT

Campos amarillos ya editables:

- `A7:A15`: insumos.
- `B7:B15`: `%MS`.
- `C7:C15`: `%INCLUSION EN MS`.
- `G7:G15`: `Costo (Bs/ton)`.

Campos amarillos faltantes:

- Ninguno detectado en el rango usado `A1:H20`.

Formulas ya replicadas exactamente:

- `B1 = F16`.
- `D7:D15 = C/B`.
- `E7:E15 = IFERROR(D/D16,0)`.
- `F7:F15 = E*B`.
- `H7:H15 = 1000*E*G/1000`.
- `C16:F16`, `H16`, `H17`.
- `C17` conserva la condicion original `C16>=99.9`.

Formulas faltantes por revisar:

- Ninguna critica detectada, falta validacion visual celda por celda contra Excel.

Diferencias visuales:

- La app usa una tabla web compacta; no replica aun merges, logo, alturas exactas ni posiciones exactas de Excel.

## TRANS

Campos amarillos ya editables:

- `A7:A15`, `B7:B15`, `C7:C15`, `G7:G15`.

Campos amarillos faltantes:

- Ninguno detectado en el rango usado `A1:H19`.

Formulas ya replicadas exactamente:

- Mismo bloque que `ADAPT`.
- `A4 = B2` se considera dato auxiliar; todavia no se muestra como celda independiente.

Formulas faltantes por revisar:

- Validacion visual de `A4`.

Diferencias visuales:

- Falta igualar merges, logo y distribucion exacta de encabezados.

## TERM

Campos amarillos ya editables:

- `A7:A15`, `B7:B15`, `C7:C15`, `G7:G15`.

Campos amarillos faltantes:

- Ninguno detectado en el rango usado `A1:H19`.

Formulas ya replicadas exactamente:

- Mismo bloque que `ADAPT`.
- `A4 = B2` queda pendiente de visualizacion independiente.

Formulas faltantes por revisar:

- Validacion visual de `A4`.

Diferencias visuales:

- Falta igualar merges, logo y distribucion exacta de encabezados.

## Ingreso

Campos amarillos ya editables:

- `A6:A25`: fecha de ingreso.
- `B6:B25`: piquete.
- `C6:C25`: lote.
- `D6:D25`: cantidad de animales.
- `K6:K25`: dieta actual.
- `N6:N25`: ajuste de consumo.

Campos amarillos faltantes:

- Ninguno detectado en filas activas de ejemplo.

Campos no amarillos bloqueados:

- `E6:E25`: peso inicial.
- `G6:G25`: IMS `%PV` inicial.
- `H6:H25`: GMD estimado.
- `F`, `I`, `J`, `L`, `M`, `O`, `P`, `Q`: resultados calculados.

Formulas ya replicadas exactamente:

- `F = E + (J*H)`.
- `I = E*G*D`.
- `J = A3 - A`.
- `L = ((F*D*G)+(F*D*G*N))-ANOTACION!H+ANOTACION!I`.
- `M = IFERROR(P*D,0)`.
- `O = IFERROR(L/D,0)`.
- `P = IFERROR(O / %MS dieta,0)`.
- `Q = O/F`.
- `B30:D32` como resumen por dieta.

Formulas faltantes por revisar:

- `A3 = TODAY()` esta representado como fecha de trabajo bloqueada; falta convertirlo a calculo dinamico en navegador si se requiere comportamiento identico diario.
- `D26` y `G27` no se muestran como celdas auxiliares independientes.

Diferencias visuales:

- La tabla mantiene orden y nombres, pero no replica merges ni espacios vacios `R:U`.

## ADAPTACION

Campos amarillos ya editables:

- `E2`, `J2`, `O2`, `T2`, `Z2`: porcentaje de cada trato.

Campos amarillos faltantes:

- Ninguno detectado en encabezado de tratos.

Formulas ya replicadas exactamente:

- Se conserva la regla visible de `AB2` para `ADAPTACION`, donde el Excel suma `E2,J2,T2,Z2` y omite `O2`.
- Se conserva la validacion `AB3` con la comparacion original contra `99.9`.

Formulas faltantes por revisar:

- Bloques `A4:Z13`.
- Bloques `A17:AG36`.
- Totales `AD:AG`.
- Validacion celda por celda de previsto, realizado, costo/trato, costo lote y diaria alimentar.

Diferencias visuales:

- La app muestra un resumen por piquete/trato; falta replicar la grilla ancha de 5 tratos exactamente como Excel.
- Horarios visibles estan bloqueados porque no son amarillos.

## TRANSICION

Campos amarillos ya editables:

- `E2`, `J2`, `O2`, `T2`, `Z2`.

Campos amarillos faltantes:

- Ninguno detectado.

Formulas ya replicadas exactamente:

- `AB2 = SUM(E2,J2,O2,T2,Z2)`.
- `AB3` conserva la validacion original que omite `O2` y compara contra `99.9`.

Formulas faltantes por revisar:

- Bloques `A4:Z13`, `A17:AG36`, `AD:AG`.

Diferencias visuales:

- Igual que `ADAPTACION`: falta reproducir la grilla ancha de Excel.

## TERMINACION

Campos amarillos ya editables:

- `E2`, `J2`, `O2`, `T2`, `Z2`.

Campos amarillos faltantes:

- Ninguno detectado.

Formulas ya replicadas exactamente:

- `AB2 = SUM(E2,J2,O2,T2,Z2)`.
- `AB3` conserva la validacion original que omite `O2` y compara contra `99.9`.

Formulas faltantes por revisar:

- Bloques `A4:Z13`, `A17:AG36`, `AD:AG`.

Diferencias visuales:

- Falta reproducir la grilla ancha de Excel.

## ANOTACION DE CONSUMO

Campos amarillos ya editables:

- `H3:K22`: MS/MO previsto y realizado manual.

Campos amarillos faltantes:

- Ninguno detectado.

Formulas ya replicadas exactamente:

- Ninguna formula se declara exacta todavia porque `B3:F22` depende de hojas de reparto pendientes de validacion exacta.

Formulas faltantes por revisar:

- `B3:B22 = Ingreso!K6:K25`.
- `C3:F22` suma resultados desde `ADAPTACION`, `TRANSICION`, `TERMINACION`.

Diferencias visuales:

- La app mantiene columnas principales, pero falta igualar merges y ubicacion exacta.

## REGISTRO

Campos amarillos ya editables:

- Ninguno detectado.

Campos amarillos faltantes:

- Ninguno detectado.

Formulas ya replicadas exactamente:

- Ninguna formula se declara exacta todavia para `REGISTRO`.

Formulas faltantes por revisar:

- Las 782 formulas del informe.
- Los 20 bloques de 11 filas desde `8:18` hasta `217:227`.
- Promedios con `SUM/COUNTA`.
- Totales financieros y nutricionales.

Diferencias visuales:

- La app muestra una tabla resumen por corral; falta replicar el informe vertical por bloques como en Excel.
