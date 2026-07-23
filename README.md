# Confinamiento Arizona - App web v1

Primera version funcional para transformar el Excel `4.0 CONFINAMIENTO ARIZONA.xlsm` en una app web.

## Alcance de esta version

- Replica las secciones principales del Excel:
  - `ADAPT`
  - `TRANS`
  - `TERM`
  - `Ingreso`
  - `ADAPTACION`
  - `TRANSICION`
  - `TERMINACION`
  - `ANOTACION DE CONSUMO`
  - `REGISTRO`
- Usa datos de ejemplo.
- Separa entradas manuales y resultados calculados.
- Mantiene los resultados calculados como no editables.
- Organiza la logica de calculo fuera de las pantallas.

No incluye usuarios, permisos, licencias, panel administrador ni modo offline.

## Estructura

```text
src/
  components/     Componentes base de interfaz
  data/           Datos de ejemplo
  domain/         Modelo, formatos y motor de calculo
  screens/        Pantallas principales
  state/          Estado simple de la app
```

## Ejecutar

Desde esta carpeta:

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Abrir:

```text
http://127.0.0.1:4173/
```

## Validacion local de HISTORIAL

La Fase C incluye pruebas locales repetibles sin Vercel, previews ni despliegues:

```powershell
npm.cmd install
npm.cmd test
```

La prueba E2E levanta un servidor HTTP temporal y usa Microsoft Edge o Google Chrome
con una implementacion local simulada de Supabase. Valida dos historicos append-only,
consulta de solo lectura, preservacion del estado operativo y recuperacion tras recarga.
No modifica autenticacion, permisos, migraciones ni datos remotos.

## Siguiente paso recomendado

Comparar modulo por modulo contra el Excel:

1. Validar `Ingreso`.
2. Ajustar `ADAPT`, `TRANS` y `TERM`.
3. Validar reparto en `ADAPTACION`, `TRANSICION`, `TERMINACION`.
4. Validar `ANOTACION DE CONSUMO`.
5. Ajustar formulas finales de `REGISTRO`.
