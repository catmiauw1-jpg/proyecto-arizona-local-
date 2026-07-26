const path = require("node:path");

const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  session,
} = require("electron");
const {
  startLocalAppServer,
} = require("./localServer.cjs");

const APP_NAME = "Confinamiento Arizona";
const DESKTOP_PORT = 0;
const PROJECT_ROOT = path.resolve(__dirname, "..");

let localRuntime = null;
let mainWindow = null;

app.setName(APP_NAME);
app.setAppUserModelId("bo.arizona.confinamiento");

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function isTrustedNavigation(targetUrl, trustedOrigin) {
  try {
    return new URL(targetUrl).origin === trustedOrigin;
  } catch {
    return false;
  }
}

async function createMainWindow() {
  if (!localRuntime) {
    const databasePath = path.join(
      app.getPath("userData"),
      "data",
      "arizona.db",
    );
    localRuntime = await startLocalAppServer({
      projectRoot: PROJECT_ROOT,
      port: DESKTOP_PORT,
      databasePath,
    });
  }

  const trustedOrigin = new URL(localRuntime.url).origin;
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );

  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f4f5f1",
    icon: path.join(PROJECT_ROOT, "src", "assets", "logo-arizona.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!isTrustedNavigation(targetUrl, trustedOrigin)) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(localRuntime.url);
}

if (hasSingleInstanceLock) {
  app.on("second-instance", focusMainWindow);
  app.whenReady()
    .then(() => {
      Menu.setApplicationMenu(null);
      return createMainWindow();
    })
    .catch((error) => {
      dialog.showErrorBox(
        "No se pudo iniciar Confinamiento Arizona",
        `El sistema local no pudo abrirse.\n\n${error.message}`,
      );
      app.quit();
    });
}

app.on("activate", () => {
  if (!mainWindow && hasSingleInstanceLock) {
    createMainWindow().catch((error) => {
      dialog.showErrorBox("No se pudo abrir la ventana", error.message);
    });
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (localRuntime) void localRuntime.close();
});
