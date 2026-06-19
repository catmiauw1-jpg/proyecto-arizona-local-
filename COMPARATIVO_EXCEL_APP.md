# Comparativo Excel original vs app web

Regla actual: la pantalla de cada hoja se genera desde el snapshot del `.xlsm`, por eso la app usa la misma cantidad de filas, columnas, celdas amarillas y formulas detectadas.

| Hoja | Excel filas x columnas | App filas x columnas | Amarillas Excel | Amarillas editables app | Amarillas faltantes | Formulas Excel | Formulas coinciden | Formulas faltan | Diferencias visuales |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| `ADAPT` | 20 x 8 | 20 x 8 | 36 | 36 | 0 | 44 | Texto exacto de formulas importado desde Excel; resultados cacheados mostrados | Recalculo dinamico celda por celda pendiente (44) | Falta logo/imagen y ajuste fino de anchos/altos. La grilla, colores base y merges se renderizan desde el Excel. |
| `TRANS` | 19 x 8 | 19 x 8 | 36 | 36 | 0 | 45 | Texto exacto de formulas importado desde Excel; resultados cacheados mostrados | Recalculo dinamico celda por celda pendiente (45) | Falta logo/imagen y ajuste fino de anchos/altos. La grilla, colores base y merges se renderizan desde el Excel. |
| `TERM` | 19 x 8 | 19 x 8 | 36 | 36 | 0 | 45 | Texto exacto de formulas importado desde Excel; resultados cacheados mostrados | Recalculo dinamico celda por celda pendiente (45) | Falta logo/imagen y ajuste fino de anchos/altos. La grilla, colores base y merges se renderizan desde el Excel. |
| `Ingreso` | 44 x 21 | 44 x 21 | 123 | 123 | 0 | 172 | Texto exacto de formulas importado desde Excel; resultados cacheados mostrados | Recalculo dinamico celda por celda pendiente (172) | Falta replicar exactamente anchos/altos y algunos espacios visuales. Piquete B6:B25 queda amarillo/editable. |
| `ADAPTACION` | 36 x 37 | 36 x 37 | 105 | 105 | 0 | 702 | Texto exacto de formulas importado desde Excel; resultados cacheados mostrados | Recalculo dinamico celda por celda pendiente (702) | Grilla amplia generada con las mismas filas/columnas. Falta ajuste fino de anchos/altos y logo; formulas dinamicas pendientes. |
| `TRANSICION` | 36 x 33 | 36 x 33 | 105 | 105 | 0 | 702 | Texto exacto de formulas importado desde Excel; resultados cacheados mostrados | Recalculo dinamico celda por celda pendiente (702) | Grilla amplia generada con las mismas filas/columnas. Falta ajuste fino de anchos/altos y logo; formulas dinamicas pendientes. |
| `TERMINACION` | 36 x 33 | 36 x 33 | 105 | 105 | 0 | 702 | Texto exacto de formulas importado desde Excel; resultados cacheados mostrados | Recalculo dinamico celda por celda pendiente (702) | Grilla amplia generada con las mismas filas/columnas. Falta ajuste fino de anchos/altos y logo; formulas dinamicas pendientes. |
| `ANOTACION DE CONSUMO` | 22 x 11 | 22 x 11 | 80 | 80 | 0 | 100 | Texto exacto de formulas importado desde Excel; resultados cacheados mostrados | Recalculo dinamico celda por celda pendiente (100) | No tiene imagen en el Excel. Falta ajuste fino de anchos/altos; H3:K22 son editables. |
| `REGISTRO` | 227 x 65 | 227 x 65 | 0 | 0 | 0 | 782 | Texto exacto de formulas importado desde Excel; resultados cacheados mostrados | Recalculo dinamico celda por celda pendiente (782) | La app ya usa 227 filas x 65 columnas. Falta replicar imagen/logo, congelacion D1 y anchos/altos exactos. |

## Detalle por modulo

### ADAPT

- Hoja original: 20 filas x 8 columnas (`A1:H20`).
- Pantalla app: 20 filas x 8 columnas.
- Celdas amarillas ya editables: 36.
- Celdas amarillas faltantes: 0.
- Amarillas: A7, B7, C7, G7, A8, B8, C8, G8, A9, B9, C9, G9, A10, B10, C10, G10, A11, B11, C11, G11, A12, B12, C12, G12, A13, B13, C13, G13, A14, B14, C14, G14, A15, B15, C15, G15.
- Formulas detectadas/importadas: 44.
- Formulas con texto exacto disponible: 44.
- Formulas con recalculo dinamico pendiente: 44.
- Formulas: B1, D7, E7, F7, H7, D8, E8, F8, H8, D9, E9, F9, H9, D10, E10, F10, H10, D11, E11, F11, H11, D12, E12, F12, H12, D13, E13, F13, H13, D14, E14, F14, H14, D15, E15, F15, H15, C16, D16, E16, F16, H16, C17, H17.
- Diferencias visuales: Falta logo/imagen y ajuste fino de anchos/altos. La grilla, colores base y merges se renderizan desde el Excel.

### TRANS

- Hoja original: 19 filas x 8 columnas (`A1:H19`).
- Pantalla app: 19 filas x 8 columnas.
- Celdas amarillas ya editables: 36.
- Celdas amarillas faltantes: 0.
- Amarillas: A7, B7, C7, G7, A8, B8, C8, G8, A9, B9, C9, G9, A10, B10, C10, G10, A11, B11, C11, G11, A12, B12, C12, G12, A13, B13, C13, G13, A14, B14, C14, G14, A15, B15, C15, G15.
- Formulas detectadas/importadas: 45.
- Formulas con texto exacto disponible: 45.
- Formulas con recalculo dinamico pendiente: 45.
- Formulas: B1, A4, D7, E7, F7, H7, D8, E8, F8, H8, D9, E9, F9, H9, D10, E10, F10, H10, D11, E11, F11, H11, D12, E12, F12, H12, D13, E13, F13, H13, D14, E14, F14, H14, D15, E15, F15, H15, C16, D16, E16, F16, H16, C17, H17.
- Diferencias visuales: Falta logo/imagen y ajuste fino de anchos/altos. La grilla, colores base y merges se renderizan desde el Excel.

### TERM

- Hoja original: 19 filas x 8 columnas (`A1:H19`).
- Pantalla app: 19 filas x 8 columnas.
- Celdas amarillas ya editables: 36.
- Celdas amarillas faltantes: 0.
- Amarillas: A7, B7, C7, G7, A8, B8, C8, G8, A9, B9, C9, G9, A10, B10, C10, G10, A11, B11, C11, G11, A12, B12, C12, G12, A13, B13, C13, G13, A14, B14, C14, G14, A15, B15, C15, G15.
- Formulas detectadas/importadas: 45.
- Formulas con texto exacto disponible: 45.
- Formulas con recalculo dinamico pendiente: 45.
- Formulas: B1, A4, D7, E7, F7, H7, D8, E8, F8, H8, D9, E9, F9, H9, D10, E10, F10, H10, D11, E11, F11, H11, D12, E12, F12, H12, D13, E13, F13, H13, D14, E14, F14, H14, D15, E15, F15, H15, C16, D16, E16, F16, H16, C17, H17.
- Diferencias visuales: Falta logo/imagen y ajuste fino de anchos/altos. La grilla, colores base y merges se renderizan desde el Excel.

### Ingreso

- Hoja original: 44 filas x 21 columnas (`A1:U44`).
- Pantalla app: 44 filas x 21 columnas.
- Celdas amarillas ya editables: 123.
- Celdas amarillas faltantes: 0.
- Amarillas: B1, B2, A6, B6, C6, D6, K6, N6, A7, B7, C7, D7, K7, N7, A8, B8, C8, D8, K8, N8, A9, B9, C9, D9, K9, N9, A10, B10, C10, D10, K10, N10, A11, B11, C11, D11, K11, N11, A12, B12, C12, D12, K12, N12, A13, B13, C13, D13, K13, N13, A14, B14, C14, D14, K14, N14, A15, B15, C15, D15, K15, N15, A16, B16, C16, D16, K16, N16, A17, B17, C17, D17, K17, N17, A18, B18, C18, D18, K18, N18 ....
- Formulas detectadas/importadas: 172.
- Formulas con texto exacto disponible: 172.
- Formulas con recalculo dinamico pendiente: 172.
- Formulas: A3, F6, I6, J6, L6, M6, O6, P6, Q6, F7, I7, J7, L7, M7, O7, P7, Q7, F8, I8, J8, L8, M8, O8, P8, Q8, F9, I9, J9, L9, M9, O9, P9, Q9, F10, I10, J10, L10, M10, O10, P10, Q10, F11, I11, J11, L11, M11, O11, P11, Q11, F12, I12, J12, L12, M12, O12, P12, Q12, F13, I13, J13, L13, M13, O13, P13, Q13, F14, I14, J14, L14, M14, O14, P14, Q14, F15, I15, J15, L15, M15, O15, P15 ....
- Diferencias visuales: Falta replicar exactamente anchos/altos y algunos espacios visuales. Piquete B6:B25 queda amarillo/editable.

### ADAPTACION

- Hoja original: 36 filas x 37 columnas (`A1:AK36`).
- Pantalla app: 36 filas x 37 columnas.
- Celdas amarillas ya editables: 105.
- Celdas amarillas faltantes: 0.
- Amarillas: E2, J2, O2, T2, Z2, D17, I17, N17, S17, Y17, D18, I18, N18, S18, Y18, D19, I19, N19, S19, Y19, D20, I20, N20, S20, Y20, D21, I21, N21, S21, Y21, D22, I22, N22, S22, Y22, D23, I23, N23, S23, Y23, D24, I24, N24, S24, Y24, D25, I25, N25, S25, Y25, D26, I26, N26, S26, Y26, D27, I27, N27, S27, Y27, D28, I28, N28, S28, Y28, D29, I29, N29, S29, Y29, D30, I30, N30, S30, Y30, D31, I31, N31, S31, Y31 ....
- Formulas detectadas/importadas: 702.
- Formulas con texto exacto disponible: 702.
- Formulas con recalculo dinamico pendiente: 702.
- Formulas: AB2, AB3, A4, C4, E4, G4, H4, J4, L4, M4, O4, Q4, R4, T4, V4, W4, Z4, A5, C5, E5, G5, H5, J5, L5, M5, O5, Q5, R5, T5, V5, W5, Z5, A6, C6, E6, G6, H6, J6, L6, M6, O6, Q6, R6, T6, V6, W6, Z6, A7, C7, E7, G7, H7, J7, L7, M7, O7, Q7, R7, T7, V7, W7, Z7, A8, C8, E8, G8, H8, J8, L8, M8, O8, Q8, R8, T8, V8, W8, Z8, A9, C9, E9 ....
- Diferencias visuales: Grilla amplia generada con las mismas filas/columnas. Falta ajuste fino de anchos/altos y logo; formulas dinamicas pendientes.

### TRANSICION

- Hoja original: 36 filas x 33 columnas (`A1:AG36`).
- Pantalla app: 36 filas x 33 columnas.
- Celdas amarillas ya editables: 105.
- Celdas amarillas faltantes: 0.
- Amarillas: E2, J2, O2, T2, Z2, D17, I17, N17, S17, Y17, D18, I18, N18, S18, Y18, D19, I19, N19, S19, Y19, D20, I20, N20, S20, Y20, D21, I21, N21, S21, Y21, D22, I22, N22, S22, Y22, D23, I23, N23, S23, Y23, D24, I24, N24, S24, Y24, D25, I25, N25, S25, Y25, D26, I26, N26, S26, Y26, D27, I27, N27, S27, Y27, D28, I28, N28, S28, Y28, D29, I29, N29, S29, Y29, D30, I30, N30, S30, Y30, D31, I31, N31, S31, Y31 ....
- Formulas detectadas/importadas: 702.
- Formulas con texto exacto disponible: 702.
- Formulas con recalculo dinamico pendiente: 702.
- Formulas: AB2, AB3, A4, C4, E4, G4, H4, J4, L4, M4, O4, Q4, R4, T4, V4, W4, Z4, A5, C5, E5, G5, H5, J5, L5, M5, O5, Q5, R5, T5, V5, W5, Z5, A6, C6, E6, G6, H6, J6, L6, M6, O6, Q6, R6, T6, V6, W6, Z6, A7, C7, E7, G7, H7, J7, L7, M7, O7, Q7, R7, T7, V7, W7, Z7, A8, C8, E8, G8, H8, J8, L8, M8, O8, Q8, R8, T8, V8, W8, Z8, A9, C9, E9 ....
- Diferencias visuales: Grilla amplia generada con las mismas filas/columnas. Falta ajuste fino de anchos/altos y logo; formulas dinamicas pendientes.

### TERMINACION

- Hoja original: 36 filas x 33 columnas (`A1:AG36`).
- Pantalla app: 36 filas x 33 columnas.
- Celdas amarillas ya editables: 105.
- Celdas amarillas faltantes: 0.
- Amarillas: E2, J2, O2, T2, Z2, D17, I17, N17, S17, Y17, D18, I18, N18, S18, Y18, D19, I19, N19, S19, Y19, D20, I20, N20, S20, Y20, D21, I21, N21, S21, Y21, D22, I22, N22, S22, Y22, D23, I23, N23, S23, Y23, D24, I24, N24, S24, Y24, D25, I25, N25, S25, Y25, D26, I26, N26, S26, Y26, D27, I27, N27, S27, Y27, D28, I28, N28, S28, Y28, D29, I29, N29, S29, Y29, D30, I30, N30, S30, Y30, D31, I31, N31, S31, Y31 ....
- Formulas detectadas/importadas: 702.
- Formulas con texto exacto disponible: 702.
- Formulas con recalculo dinamico pendiente: 702.
- Formulas: AB2, AB3, A4, C4, E4, G4, H4, J4, L4, M4, O4, Q4, R4, T4, V4, W4, Z4, A5, C5, E5, G5, H5, J5, L5, M5, O5, Q5, R5, T5, V5, W5, Z5, A6, C6, E6, G6, H6, J6, L6, M6, O6, Q6, R6, T6, V6, W6, Z6, A7, C7, E7, G7, H7, J7, L7, M7, O7, Q7, R7, T7, V7, W7, Z7, A8, C8, E8, G8, H8, J8, L8, M8, O8, Q8, R8, T8, V8, W8, Z8, A9, C9, E9 ....
- Diferencias visuales: Grilla amplia generada con las mismas filas/columnas. Falta ajuste fino de anchos/altos y logo; formulas dinamicas pendientes.

### ANOTACION DE CONSUMO

- Hoja original: 22 filas x 11 columnas (`A1:K22`).
- Pantalla app: 22 filas x 11 columnas.
- Celdas amarillas ya editables: 80.
- Celdas amarillas faltantes: 0.
- Amarillas: H3, I3, J3, K3, H4, I4, J4, K4, H5, I5, J5, K5, H6, I6, J6, K6, H7, I7, J7, K7, H8, I8, J8, K8, H9, I9, J9, K9, H10, I10, J10, K10, H11, I11, J11, K11, H12, I12, J12, K12, H13, I13, J13, K13, H14, I14, J14, K14, H15, I15, J15, K15, H16, I16, J16, K16, H17, I17, J17, K17, H18, I18, J18, K18, H19, I19, J19, K19, H20, I20, J20, K20, H21, I21, J21, K21, H22, I22, J22, K22.
- Formulas detectadas/importadas: 100.
- Formulas con texto exacto disponible: 100.
- Formulas con recalculo dinamico pendiente: 100.
- Formulas: B3, C3, D3, E3, F3, B4, C4, D4, E4, F4, B5, C5, D5, E5, F5, B6, C6, D6, E6, F6, B7, C7, D7, E7, F7, B8, C8, D8, E8, F8, B9, C9, D9, E9, F9, B10, C10, D10, E10, F10, B11, C11, D11, E11, F11, B12, C12, D12, E12, F12, B13, C13, D13, E13, F13, B14, C14, D14, E14, F14, B15, C15, D15, E15, F15, B16, C16, D16, E16, F16, B17, C17, D17, E17, F17, B18, C18, D18, E18, F18 ....
- Diferencias visuales: No tiene imagen en el Excel. Falta ajuste fino de anchos/altos; H3:K22 son editables.

### REGISTRO

- Hoja original: 227 filas x 65 columnas (`A1:BM227`).
- Pantalla app: 227 filas x 65 columnas.
- Celdas amarillas ya editables: 0.
- Celdas amarillas faltantes: 0.
- Amarillas: ninguna.
- Formulas detectadas/importadas: 782.
- Formulas con texto exacto disponible: 782.
- Formulas con recalculo dinamico pendiente: 782.
- Formulas: A2, C7, C8, E8, G8, E9, G9, C10, E10, G10, H10, C11, E11, G11, H11, C12, E12, G12, H12, C13, E13, G13, H13, C14, E14, G14, H14, C15, E15, G15, H15, C16, E16, G16, H16, C17, E17, C18, E18, G18, H18, C19, E19, G19, E20, G20, C21, E21, G21, H21, C22, E22, G22, H22, C23, E23, G23, H23, C24, E24, G24, H24, C25, E25, G25, H25, C26, E26, G26, H26, C27, E27, G27, H27, C28, E28, C29, E29, G29, H29 ....
- Diferencias visuales: La app ya usa 227 filas x 65 columnas. Falta replicar imagen/logo, congelacion D1 y anchos/altos exactos.
