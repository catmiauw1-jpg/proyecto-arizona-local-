const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  startLocalAppServer,
} = require("../desktop/localServer.cjs");

test("desktop server exposes only the local application and SQLite adapter", async (context) => {
  const runtime = await startLocalAppServer({
    projectRoot: path.resolve(__dirname, ".."),
    port: 0,
  });
  context.after(() => runtime.close());

  const configResponse = await fetch(new URL("/api/config", runtime.url));
  assert.equal(configResponse.status, 200);
  assert.deepEqual(await configResponse.json(), {
    configured: true,
    supabaseUrl: "http://127.0.0.1/arizona-local",
    supabasePublishableKey: "arizona-local-only-key",
  });

  const indexResponse = await fetch(runtime.url);
  assert.equal(indexResponse.status, 200);
  assert.match(await indexResponse.text(), /Confinamiento Arizona/);

  const clientResponse = await fetch(
    new URL("/src/services/supabaseClient.js", runtime.url),
  );
  const clientSource = await clientResponse.text();
  assert.equal(clientResponse.status, 200);
  assert.doesNotMatch(clientSource, /https:\/\/esm\.sh/);
  assert.match(clientSource, /\/desktop\/localSupabaseClient\.js/);

  const adapterResponse = await fetch(
    new URL("/desktop/localSupabaseClient.js", runtime.url),
  );
  const adapterSource = await adapterResponse.text();
  assert.equal(adapterResponse.status, 200);
  assert.match(adapterSource, /function createClient/);
  assert.match(adapterSource, /\/api\/local\/rpc/);

  const privateFileResponse = await fetch(
    new URL("/package.json", runtime.url),
  );
  assert.equal(privateFileResponse.status, 404);
});

test("desktop SQLite API saves and lists work-day snapshots", async (context) => {
  const runtime = await startLocalAppServer({
    projectRoot: path.resolve(__dirname, ".."),
    port: 0,
    initialWorkDate: "2026-07-26",
  });
  context.after(() => runtime.close());
  const bootstrap = await fetch(runtime.url);
  const cookie = bootstrap.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  async function post(pathname, body) {
    const response = await fetch(new URL(pathname, runtime.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: new URL(runtime.url).origin,
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    return response.json();
  }

  const active = await post("/api/local/rpc", {
    name: "ensure_active_work_day",
    params: {},
  });
  assert.equal(active.error, null);
  assert.equal(active.data.work_day.work_date, "2026-07-26");

  const saved = await post("/api/local/rpc", {
    name: "save_work_day_snapshot",
    params: {
      p_work_day_id: active.data.work_day.id,
      p_input_state: {
        config: {
          clientName: "Confinamiento Arizona",
          workDate: "2026-07-26",
        },
      },
      p_computed_state: { reportRows: [] },
      p_summary: { workDate: "2026-07-26" },
      p_snapshot_type: "manual_save",
    },
  });
  assert.equal(saved.error, null);
  assert.ok(saved.data.snapshot_id);

  const listed = await post("/api/local/query", {
    table: "work_day_snapshots",
    filters: [
      { field: "period_id", value: active.data.period.id },
      { field: "snapshot_type", value: "manual_save" },
    ],
    orders: [{ field: "saved_at", ascending: false }],
  });
  assert.equal(listed.error, null);
  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0].input_state.config.workDate, "2026-07-26");
});

test("desktop API rejects missing capabilities and reflected hostile origins", async (context) => {
  const runtime = await startLocalAppServer({
    projectRoot: path.resolve(__dirname, ".."),
    port: 0,
  });
  context.after(() => runtime.close());
  const bootstrap = await fetch(runtime.url);
  const cookie = bootstrap.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  const payload = JSON.stringify({
    name: "ensure_active_work_day",
    params: {},
  });

  const noOrigin = await fetch(new URL("/api/local/rpc", runtime.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: payload,
  });
  assert.equal(noOrigin.status, 403);

  const noCapability = await fetch(new URL("/api/local/rpc", runtime.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(runtime.url).origin,
    },
    body: payload,
  });
  assert.equal(noCapability.status, 403);

  const runtimePort = new URL(runtime.url).port;
  const reflectedOrigin = await fetch(
    new URL("/api/local/rpc", runtime.url),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: `attacker.example:${runtimePort}`,
        Origin: `http://attacker.example:${runtimePort}`,
        Cookie: cookie,
      },
      body: payload,
    },
  );
  assert.equal(reflectedOrigin.status, 403);
});

test("desktop server rejects unsupported methods", async (context) => {
  const runtime = await startLocalAppServer({
    projectRoot: path.resolve(__dirname, ".."),
    port: 0,
  });
  context.after(() => runtime.close());

  const response = await fetch(runtime.url, { method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});
