const { app, BrowserWindow, shell, session } = require('electron');
const path = require('node:path');
const { fork } = require('node:child_process');

let serverProcess;
const isDev = !app.isPackaged;

function startBundledServer() {
  if (isDev) return;
  const serverEntry = path.join(process.resourcesPath, 'app.asar', 'dist', 'index.js');
  serverProcess = fork(serverEntry, [], { env: { ...process.env, NODE_ENV: 'production', PORT: '4173' }, silent: true });
  serverProcess.on('error', (error) => console.error('PipeFlow backend failed to start', error));
}

function createWindow() {
  const url = isDev ? 'http://localhost:3000' : 'http://127.0.0.1:4173';
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#07111f',
    title: 'PipeFlow Pro',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  win.loadURL(url);
}

app.whenReady().then(() => {
  startBundledServer();
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

process.on('SIGINT', () => { if (serverProcess) serverProcess.kill(); });
