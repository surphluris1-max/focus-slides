const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const IMG = /\.(jpe?g|png|webp)$/i;
let win;
let wantFull = true;

// Bundled assets live in assets/, custom slides live in userData/custom_slides/
function folders() {
  const base = app.getPath("userData");
  const customSlides = path.join(base, "custom_slides");
  fs.mkdirSync(customSlides, { recursive: true });

  const bundled = path.join(__dirname, "assets", "slides");
  const alarm = path.join(base, "alarm.jpg");
  if (!fs.existsSync(alarm)) {
    const bundledAlarm = path.join(__dirname, "assets", "alarm.jpg");
    if (fs.existsSync(bundledAlarm)) fs.copyFileSync(bundledAlarm, alarm);
  }
  return { base, customSlides, bundled, alarm };
}

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    backgroundColor: "#0d0b12",
    title: "Focus Slides",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  win.removeMenu();
  win.loadFile("index.html");
  win.on("restore", () => { if (wantFull) win.setFullScreen(true); });
}

ipcMain.handle("assets", () => {
  const f = folders();
  const defaultSlides = fs.existsSync(f.bundled)
    ? fs.readdirSync(f.bundled).filter((n) => IMG.test(n)).sort()
        .map((n) => pathToFileURL(path.join(f.bundled, n)).href)
    : [];

  const customSlides = fs.readdirSync(f.customSlides).filter((n) => IMG.test(n)).sort()
    .map((n) => pathToFileURL(path.join(f.customSlides, n)).href);

  return {
    defaultSlides,
    customSlides,
    alarm: pathToFileURL(f.alarm).href + "?t=" + Date.now()
  };
});

ipcMain.handle("add-images", async () => {
  const f = folders();
  const result = await dialog.showOpenDialog(win, {
    title: "Select Images for Slideshow",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }]
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { added: 0 };
  }
  let added = 0;
  for (const src of result.filePaths) {
    const baseName = path.basename(src);
    let destName = baseName;
    let counter = 1;
    while (fs.existsSync(path.join(f.customSlides, destName))) {
      const ext = path.extname(baseName);
      const nameWithoutExt = path.basename(baseName, ext);
      destName = `${nameWithoutExt}_${counter++}${ext}`;
    }
    fs.copyFileSync(src, path.join(f.customSlides, destName));
    added++;
  }
  return { added };
});

ipcMain.handle("open-folder", () => shell.openPath(folders().customSlides));
ipcMain.on("minimize", () => {
  wantFull = win.isFullScreen();
  win.setFullScreen(false);
  setTimeout(() => win.minimize(), 200);
});
ipcMain.on("toggle-full", () => { wantFull = !win.isFullScreen(); win.setFullScreen(wantFull); });
ipcMain.on("front", () => {
  if (win.isMinimized()) win.restore();
  win.show();
  win.setAlwaysOnTop(true);
  win.focus();
  setTimeout(() => win.setAlwaysOnTop(false), 1500);
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
