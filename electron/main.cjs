const { app, BrowserWindow, shell, session } = require('electron');
const path = require('node:path');
const { fork } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');

let serverProcess;
const isDev = !app.isPackaged;
const isSmokeTest = process.argv.includes('--smoke-test');

function startBundledServer() {
  if (isDev) return;
  const serverEntry = path.join(process.resourcesPath, 'app.asar', 'dist', 'index.js');
  serverProcess = fork(serverEntry, [], { env: { ...process.env, NODE_ENV: 'production', PORT: '4173' }, silent: true });
  serverProcess.on('error', (error) => console.error('PipeFlow backend failed to start', error));
}

function waitForBundledServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get('http://127.0.0.1:4173', response => {
        response.resume();
        resolve();
      });
      request.on('error', () => {
        if (Date.now() >= deadline) return reject(new Error('bundled backend did not become ready'));
        setTimeout(attempt, 250);
      });
      request.setTimeout(1000, () => request.destroy());
    };
    attempt();
  });
}

function writeSmokeResult(result) {
  const output = process.env.PIPEFLOW_SMOKE_RESULT;
  if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2));
}

async function runSmokeTest() {
  const startedAt = Date.now();
  startBundledServer();
  try {
    await waitForBundledServer();
    const win = createWindow();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('renderer did not finish loading')), 30000);
      win.webContents.once('did-finish-load', () => { clearTimeout(timeout); resolve(); });
      win.webContents.once('did-fail-load', (_event, code, description) => { clearTimeout(timeout); reject(new Error(`renderer load failed (${code}): ${description}`)); });
    });
    writeSmokeResult({ status: 'passed', durationMs: Date.now() - startedAt, version: app.getVersion() });
    app.exit(0);
  } catch (error) {
    writeSmokeResult({ status: 'failed', durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error), version: app.getVersion() });
    app.exit(1);
  }
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

  if (!isSmokeTest) win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  win.loadURL(url);
  return win;
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  if (isSmokeTest) return runSmokeTest();
  startBundledServer();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

process.on('SIGINT', () => { if (serverProcess) serverProcess.kill(); });
