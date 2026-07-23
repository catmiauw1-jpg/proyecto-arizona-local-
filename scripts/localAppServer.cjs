const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const requestedPort = Number.parseInt(process.env.PORT || "4173", 10);
const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535
  ? requestedPort
  : 4173;
const remoteSupabaseModule = "https://esm.sh/@supabase/supabase-js@2.53.0";
const localSupabaseModule = "/tests/fixtures/supabasePhaseDMock.js";
const activePhase = process.env.npm_lifecycle_event === "dev:phase-d" ? "Fase D" : "Fase E";

function contentType(filePath) {
  const types = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".png", "image/png"],
  ]);
  return types.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function sendJson(response, value) {
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

function resolveStaticPath(pathname) {
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const filePath = path.resolve(projectRoot, relativePath);
  if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${path.sep}`)) return null;
  return filePath;
}

function serveStatic(requestUrl, response) {
  const filePath = resolveStaticPath(requestUrl.pathname);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  let body = fs.readFileSync(filePath);
  if (filePath.endsWith(path.join("src", "services", "supabaseClient.js"))) {
    const source = body.toString("utf8");
    if (!source.includes(remoteSupabaseModule)) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("El servidor local no pudo sustituir el cliente remoto de Supabase.");
      return;
    }
    body = Buffer.from(source.replace(remoteSupabaseModule, localSupabaseModule), "utf8");
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentType(filePath),
  });
  response.end(body);
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${host}:${port}`);
  if (requestUrl.pathname === "/api/config") {
    sendJson(response, {
      configured: true,
      supabaseUrl: "http://127.0.0.1/phase-d-mock",
      supabasePublishableKey: "phase-d-local-test-key",
    });
    return;
  }
  serveStatic(requestUrl, response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`El puerto ${port} ya está ocupado. Use: $env:PORT=4174; npm.cmd run dev:phase-e`);
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(port, host, () => {
  console.log(`${activePhase} local disponible en http://${host}:${port}/`);
  console.log("Servidor de prueba local: no usa Vercel ni modifica Supabase.");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
