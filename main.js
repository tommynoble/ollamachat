const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let pythonProcess = null;

// Create the main application window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        titleBarStyle: 'default',
        show: false // Don't show until ready
    });

    // Load the HTML file
    mainWindow.loadFile('index.html');

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Focus the window
        if (process.platform === 'darwin') {
            app.dock.show();
        }
        mainWindow.focus();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        if (pythonProcess) {
            pythonProcess.kill();
        }
    });

    // Open DevTools in development
    // mainWindow.webContents.openDevTools();
}

// App event listeners
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC handlers for communicating with renderer process
ipcMain.handle('send-message', async (event, message) => {
    return new Promise((resolve, reject) => {
        // Spawn Python process to handle the chat
        const python = spawn('python3', [
            '-c', 
            `
import sys
import json
sys.path.append('${__dirname}')
from ollama_chat import OllamaChat

try:
    chat = OllamaChat()
    message = sys.argv[1]
    response = chat.send_message(message)
    print(json.dumps({"success": True, "response": response}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
            `,
            message
        ]);

        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(output.trim());
                    resolve(result);
                } catch (e) {
                    reject({ success: false, error: 'Failed to parse response' });
                }
            } else {
                reject({ success: false, error: error || 'Python process failed' });
            }
        });
    });
});

ipcMain.handle('get-models', async (event) => {
    return new Promise((resolve, reject) => {
        const python = spawn('python3', [
            '-c',
            `
import sys
import json
sys.path.append('${__dirname}')
from ollama_chat import OllamaChat

try:
    chat = OllamaChat()
    models = chat.get_available_models()
    print(json.dumps({"success": True, "models": models}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
            `
        ]);

        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(output.trim());
                    resolve(result);
                } catch (e) {
                    reject({ success: false, error: 'Failed to parse models' });
                }
            } else {
                reject({ success: false, error: error || 'Failed to get models' });
            }
        });
    });
});

ipcMain.handle('check-ollama-status', async (event) => {
    return new Promise((resolve) => {
        const python = spawn('python3', [
            '-c',
            `
import sys
import json
sys.path.append('${__dirname}')
from ollama_chat import OllamaChat

try:
    chat = OllamaChat()
    installed = chat.check_ollama_installation()
    running = chat.check_ollama_server()
    print(json.dumps({"installed": installed, "running": running}))
except Exception as e:
    print(json.dumps({"installed": False, "running": False}))
            `
        ]);

        let output = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.on('close', (code) => {
            try {
                const result = JSON.parse(output.trim());
                resolve(result);
            } catch (e) {
                resolve({ installed: false, running: false });
            }
        });
    });
});

// External drive detection
ipcMain.handle('detect-external-drives', async (event) => {
    return new Promise((resolve, reject) => {
        const python = spawn('python3', [
            '-c',
            `
import sys
import os
import json
sys.path.append('${__dirname}')
from drive_detector import detect_external_drives

try:
    drives = detect_external_drives()
    print(json.dumps({"success": True, "drives": drives}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
            `
        ]);

        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(output.trim());
                    resolve(result);
                } catch (e) {
                    reject({ success: false, error: 'Failed to parse response' });
                }
            } else {
                reject({ success: false, error: error || 'Drive detection failed' });
            }
        });
    });
});

// Eject drive
ipcMain.handle('eject-drive', async (event, driveName, force = false) => {
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        
        // Use unmountDisk with force flag if requested
        const command = force ? 'unmountDisk' : 'eject';
        const args = force ? ['force', `/Volumes/${driveName}`] : [`/Volumes/${driveName}`];
        
        const diskutil = spawn('diskutil', [command, ...args]);
        
        let output = '';
        let error = '';

        diskutil.stdout.on('data', (data) => {
            output += data.toString();
        });

        diskutil.stderr.on('data', (data) => {
            error += data.toString();
        });

        diskutil.on('close', (code) => {
            if (code === 0) {
                const method = force ? 'force ejected' : 'ejected';
                resolve({ success: true, message: `Drive ${driveName} ${method} successfully` });
            } else {
                const errorMessage = error || output || 'Eject failed';
                console.log('Diskutil failed with code:', code);
                console.log('Error output:', errorMessage);
                // Resolve with error instead of rejecting
                resolve({ success: false, error: errorMessage });
            }
        });
    });
}); 

// Use external drive for Ollama models
ipcMain.handle('use-for-models', async (event, driveName, drivePath) => {
    return new Promise((resolve, reject) => {
        const fs = require('fs');
        const path = require('path');
        const { spawn } = require('child_process');
        
        try {
            // Create the ollama-models directory structure on external drive
            const modelsPath = path.join(drivePath, 'ollama-models');
            const blobsPath = path.join(modelsPath, 'blobs');
            const manifestsPath = path.join(modelsPath, 'manifests');
            
            // Create directories if they don't exist
            if (!fs.existsSync(modelsPath)) {
                fs.mkdirSync(modelsPath, { recursive: true });
            }
            if (!fs.existsSync(blobsPath)) {
                fs.mkdirSync(blobsPath, { recursive: true });
            }
            if (!fs.existsSync(manifestsPath)) {
                fs.mkdirSync(manifestsPath, { recursive: true });
            }
            
            // Get current OLLAMA_MODELS path to store as fallback
            const currentModelsPath = process.env.OLLAMA_MODELS || '/Users/yevetteasante/.ollama/models';
            
            // Store the configuration in a file for persistence
            const configPath = path.join(__dirname, 'ollama-config.json');
            const config = {
                originalPath: currentModelsPath,
                externalPath: modelsPath,
                usingExternal: true,
                driveName: driveName,
                timestamp: new Date().toISOString()
            };
            
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            
            // Move existing models if they exist locally
            let moveMessage = '';
            if (fs.existsSync(currentModelsPath) && currentModelsPath !== modelsPath) {
                try {
                    const localFiles = fs.readdirSync(currentModelsPath);
                    if (localFiles.length > 0) {
                        // Copy existing models to external drive
                        const { spawn } = require('child_process');
                        const rsync = spawn('rsync', ['-av', `${currentModelsPath}/`, `${modelsPath}/`]);
                        
                        // Note: This is async, but we'll indicate it's happening
                        moveMessage = ` Local models are being moved to external drive.`;
                    }
                } catch (copyError) {
                    console.warn('Could not move existing models:', copyError.message);
                    moveMessage = ' (Warning: Could not move existing local models)';
                }
            }
            
            // Set the environment variable for this session
            process.env.OLLAMA_MODELS = modelsPath;
            
            resolve({ 
                success: true, 
                message: `External drive '${driveName}' is now configured for Ollama models.${moveMessage}`,
                modelsPath: modelsPath,
                originalPath: currentModelsPath,
                restartRequired: true,
                modelsMoved: moveMessage.length > 0
            });
            
        } catch (error) {
            console.error('Error setting up external drive for models:', error);
            resolve({ 
                success: false, 
                error: `Failed to setup external drive: ${error.message}` 
            });
        }
    });
}); 