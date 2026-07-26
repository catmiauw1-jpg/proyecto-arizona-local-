const path = require("node:path");

const {
  startLocalAppServer,
} = require("../desktop/localServer.cjs");

const projectRoot = path.resolve(__dirname, "..");
const requestedPort = Number.parseInt(process.env.PORT || "4173", 10);
const port =
  Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535
    ? requestedPort
    : 4173;
const activePhase =
  process.env.npm_lifecycle_event === "dev:phase-d" ? "Fase D" : "Fase E";
const databasePath =
  process.env.ARIZONA_DB_PATH ||
  path.join(
    process.env.LOCALAPPDATA || projectRoot,
    "ConfinamientoArizonaDev",
    "arizona-dev.db",
  );

async function main() {
  const runtime = await startLocalAppServer({
    projectRoot,
    port,
    databasePath,
  });
  console.log(`${activePhase} local disponible en ${runtime.url}`);
  console.log(`Base SQLite local: ${databasePath}`);

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      runtime.close().finally(() => process.exit(0));
    });
  }
}

main().catch((error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `El puerto ${port} ya esta ocupado. Use: $env:PORT=4174; npm.cmd run dev:phase-e`,
    );
    process.exitCode = 1;
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
