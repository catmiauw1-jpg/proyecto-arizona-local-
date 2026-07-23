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

No incluye panel de usuarios, pagos, renovacion en linea ni modo offline.

## Estructura

```text
src/
  components/     Componentes base de interfaz
  data/           Datos de ejemplo
  domain/         Modelo, formatos y motor de calculo
  screens/        Pantallas principales
  state/          Estado simple de la app
```

## Ejecutar Fase E local

Desde esta carpeta:

```powershell
npm.cmd install
npm.cmd run dev:phase-e
```

Abrir:

```text
http://127.0.0.1:4173/
```

El servidor `dev:phase-e` es una herramienta local de validacion. Sustituye Supabase
por una simulacion guardada en `localStorage`, muestra selectores temporales de rol y
estado de licencia, y no realiza deploys ni modifica datos remotos. No forma parte de
la interfaz final.

## Licencia local de 30 dias

- La vigencia se calcula con fechas completas `YYYY-MM-DD` y vence 30 dias despues
  de la activacion.
- Los estados disponibles son `Activa`, `Proxima a vencer`, `Vencida`, `Bloqueada`
  y `No configurada`.
- Una licencia vencida, bloqueada o no configurada conserva los datos visibles, pero
  deshabilita edicion, guardado diario, guardado historico y acciones operativas.
- La pantalla `LICENCIA` permanece disponible junto con el nombre del cliente y el
  cierre de sesion.
- La configuracion de licencia usa la clave local `__arizona_local_license_v1__`,
  separada del estado operativo y de los historicos.
- Esta fase valida el comportamiento local, pero no es una proteccion comercial
  anti-manipulacion: una licencia productiva requerira firma o validacion confiable
  en una fase futura, fuera de las restricciones actuales.

## Roles y bloqueos locales

- `Administrador Arizona`: configura dietas, horarios, porcentajes, datos iniciales,
  bloqueos, guardado diario e historico.
- `Operador`: consulta configuraciones, registra realizados y consumo, guarda el dia
  y consulta REGISTRO e HISTORIAL.
- Los bloqueos se guardan dentro del `input_state` operativo ya existente.
- Desbloquear dietas o datos iniciales requiere confirmacion.
- Todo historico se abre como `Vista historica - Solo consulta`.

## Validacion local de HISTORIAL

Las Fases C, D y E incluyen pruebas locales repetibles sin Vercel, previews ni despliegues:

```powershell
npm.cmd install
npm.cmd test
```

La suite valida historial append-only, roles, bloqueos, los cinco estados de licencia,
fechas sin desfases de zona horaria, persistencia tras recarga, proteccion ante
manipulacion del DOM y regresion de calculos. La cobertura de los dominios de permisos
y licencia debe permanecer por encima de 80%. No modifica migraciones, politicas,
autenticacion ni datos remotos.

## Siguiente paso recomendado

Comparar modulo por modulo contra el Excel:

1. Validar `Ingreso`.
2. Ajustar `ADAPT`, `TRANS` y `TERM`.
3. Validar reparto en `ADAPTACION`, `TRANSICION`, `TERMINACION`.
4. Validar `ANOTACION DE CONSUMO`.
5. Ajustar formulas finales de `REGISTRO`.
