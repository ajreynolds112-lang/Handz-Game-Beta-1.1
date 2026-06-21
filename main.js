const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');
const net = require('net');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow;
let serverProcess;
let PORT;

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function waitForServer(url, retries, delay, callback) {
  http.get(url, (res) => {
    res.resume();
    callback(null);
  }).on('error', () => {
    if (retries === 0) return callback(new Error('Server failed to start'));
    setTimeout(() => waitForServer(url, retries - 1, delay, callback), delay);
  });
}

function startServer() {
  return new Promise(async (resolve, reject) => {
    PORT = await getAvailablePort();
    const appPath = app.getAppPath();
    const serverPath = path.join(appPath, 'dist', 'server', 'index.js');

    serverProcess = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: String(PORT),
        HANDZ_USER_DATA: app.getPath('userData'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    serverProcess.stdout.on('data', d => console.log('[server]', d.toString().trim()));
    serverProcess.stderr.on('data', d => console.error('[server error]', d.toString().trim()));
    serverProcess.on('error', err => {
      console.error('[main] spawn error:', err);
      reject(err);
    });
    serverProcess.on('exit', (code, signal) => {
      console.log('[main] server exited code:', code, 'signal:', signal);
    });

    waitForServer('http://127.0.0.1:' + PORT + '/api/fighters', 40, 500,
      err => err ? reject(err) : resolve());
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#000000',
    title: 'Handz - The Boxing Game',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL('http://127.0.0.1:' + PORT);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error('Could not start:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
