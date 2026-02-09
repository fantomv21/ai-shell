/**
 * NLSH Terminal - Electron Main Process
 * Creates a native terminal window running the nlsh shell
 */

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const os = require('os');
const pty = require('node-pty');

// Determine shell and nlsh paths
const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
const nlshPath = path.join(__dirname, '..', 'dist', 'cli.js');

let mainWindow;
let ptyProcess;

function createWindow() {
    // Create the browser window with terminal-like appearance
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 650,
        minWidth: 600,
        minHeight: 400,
        backgroundColor: '#0a0a0f',
        frame: false, // Frameless for custom title bar
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        icon: path.join(__dirname, 'icon.ico'),
        show: false // Don't show until ready
    });

    // Load the terminal UI
    mainWindow.loadFile('index.html');

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Start the PTY process
    startPty();

    // Handle window close
    mainWindow.on('closed', () => {
        if (ptyProcess) {
            ptyProcess.kill();
        }
        mainWindow = null;
    });
}

function startPty() {
    // Get shell environment
    const env = Object.assign({}, process.env);

    // Create PTY process - start with nlsh directly or shell
    const useNlsh = require('fs').existsSync(nlshPath);

    ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: process.env.HOME || process.env.USERPROFILE,
        env: env
    });

    // If nlsh exists, start it after a brief delay
    if (useNlsh) {
        setTimeout(() => {
            ptyProcess.write(`node "${nlshPath}"\r`);
        }, 500);
    }

    // Send PTY output to renderer
    ptyProcess.onData((data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('terminal-data', data);
        }
    });

    ptyProcess.onExit(({ exitCode }) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('terminal-exit', exitCode);
        }
    });
}

// Handle terminal input from renderer
ipcMain.on('terminal-input', (event, data) => {
    if (ptyProcess) {
        ptyProcess.write(data);
    }
});

// Handle terminal resize
ipcMain.on('terminal-resize', (event, { cols, rows }) => {
    if (ptyProcess) {
        ptyProcess.resize(cols, rows);
    }
});

// Window controls
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

// Restart nlsh
ipcMain.on('restart-nlsh', () => {
    if (ptyProcess) {
        ptyProcess.write('\x03'); // Ctrl+C
        setTimeout(() => {
            ptyProcess.write(`node "${nlshPath}"\r`);
        }, 200);
    }
});

// App ready
app.whenReady().then(() => {
    createWindow();

    // Remove default menu
    Menu.setApplicationMenu(null);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Clean up PTY on quit
app.on('before-quit', () => {
    if (ptyProcess) {
        ptyProcess.kill();
    }
});
