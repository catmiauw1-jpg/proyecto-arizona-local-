# Confinamiento Arizona - Aplicacion local v1

Primera version funcional para transformar el Excel `4.0 CONFINAMIENTO ARIZONA.xlsm`
en una aplicacion local para Windows.

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

No incluye pagos ni renovacion en linea.

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

El servidor `dev:phase-e` es una herramienta local de validacion. Usa una base SQLite
guardada en `%LOCALAPPDATA%\ConfinamientoArizonaDev\arizona-dev.db`, muestra selectores
temporales de rol y estado de licencia, y no realiza deploys ni modifica datos remotos.
Cuando encuentra datos de la simulacion anterior en `localStorage`, intenta importarlos
una sola vez antes de crear el primer dia SQLite.

## Ejecutable portable para Windows

Para abrir la aplicacion en modo escritorio durante el desarrollo:

```powershell
npm.cmd run desktop
```

Para generar un unico ejecutable portable de Windows de 64 bits:

```powershell
npm.cmd run build:desktop
```

El resultado se crea en:

```text
release/Confinamiento-Arizona-Portable-1.0.0.exe
```

El portable incorpora Electron y no requiere Node.js, Vercel, Supabase ni conexion a
Internet. Inicia un servidor interno en `127.0.0.1` con un puerto aleatorio y una
credencial temporal por sesion. La informacion se guarda en `data\arizona.db` dentro
del perfil de la aplicacion de Windows. Reemplazar el ejecutable no elimina esta base.

Esta version de prueba no esta firmada con un certificado comercial. Windows puede
mostrar una advertencia de SmartScreen; antes de ejecutarla se debe comprobar que el
archivo provenga de una fuente confiable y, cuando corresponda, validar su SHA-256.

## Licencia local de 30 dias

- La vigencia se calcula con fechas completas `YYYY-MM-DD` y vence 30 dias despues
  de la activacion.
- Los estados disponibles son `Activa`, `Proxima a vencer`, `Vencida`, `Bloqueada`
  y `No configurada`.
- Una licencia vencida, bloqueada o no configurada conserva los datos visibles, pero
  deshabilita edicion, guardado diario, guardado historico y acciones operativas.
- La pantalla `LICENCIA` permanece disponible junto con el nombre del cliente.
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

## Guardado y cierre diario

- `Guardar avance` crea un punto de recuperacion del dia activo sin cambiar la fecha.
- `Cerrar y guardar dia` solicita confirmacion, guarda el registro historico y cierra
  la jornada mediante una sola transaccion SQLite.
- El sistema abre automaticamente el dia calendario siguiente.
- Se conservan cliente, dietas, ingredientes, horarios, porcentajes, lotes, animales,
  dieta actual, ajuste de consumo y bloqueos.
- Se limpian realizados de los cinco tratos, cargas manuales por insumo, anotaciones
  de consumo y correcciones temporales de REGISTRO.
- Un segundo intento de cierre no duplica el historico.
- El administrador puede guardar una correccion como un nuevo registro sin borrar el
  original.

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
