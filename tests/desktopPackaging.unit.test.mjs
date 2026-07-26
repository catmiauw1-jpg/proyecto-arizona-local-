import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("desktop package builds one local-only Windows portable executable", async () => {
  const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
  const desktopMain = await readFile(path.resolve("desktop/main.cjs"), "utf8");
  const localServer = await readFile(path.resolve("desktop/localServer.cjs"), "utf8");
  const indexHtml = await readFile(path.resolve("index.html"), "utf8");

  assert.equal(packageJson.main, "desktop/main.cjs");
  assert.equal(
    packageJson.scripts["build:desktop"],
    "electron-builder --win portable --x64",
  );
  assert.equal(packageJson.build.appId, "bo.arizona.confinamiento");
  assert.deepEqual(packageJson.build.win.target, [
    {
      target: "portable",
      arch: ["x64"],
    },
  ]);
  assert.match(
    packageJson.build.win.artifactName,
    /^Confinamiento-Arizona-Portable-\$\{version\}\.\$\{ext\}$/,
  );
  assert.equal(packageJson.build.win.icon, "desktop/app-icon.ico");
  assert.ok((await stat(path.resolve(packageJson.build.win.icon))).size > 0);
  assert.ok(
    packageJson.build.files.includes("desktop/**/*"),
  );
  assert.equal(
    packageJson.build.files.includes("tests/fixtures/supabasePhaseDMock.js"),
    false,
  );

  assert.match(desktopMain, /nodeIntegration:\s*false/);
  assert.match(desktopMain, /contextIsolation:\s*true/);
  assert.match(desktopMain, /sandbox:\s*true/);
  assert.match(desktopMain, /setPermissionRequestHandler/);
  assert.match(desktopMain, /setWindowOpenHandler/);
  assert.match(desktopMain, /DESKTOP_PORT\s*=\s*0/);
  assert.match(desktopMain, /app\.getPath\("userData"\)/);
  assert.match(desktopMain, /arizona\.db/);

  assert.match(localServer, /role:\s*"operator"/);

  assert.match(indexHtml, /Content-Security-Policy/);
  assert.match(indexHtml, /connect-src 'self'/);
});
