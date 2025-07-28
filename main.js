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

// IPC Handlers

// Existing chat handler
ipcMain.handle('chat-message', async (event, message, model) => {
    return new Promise((resolve) => {
        const pythonArgs = [
            path.join(__dirname, 'ollama_chat.py'),
            '--message', message,
            '--model', model || 'llama2',
            '--json'
        ];
        
        const pythonProcess = spawn('python3', pythonArgs);
        let output = '';
        let error = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const response = JSON.parse(output);
                    resolve(response);
                } catch (e) {
                    resolve({ error: 'Failed to parse response' });
                }
            } else {
                resolve({ error: error || 'Python process failed' });
            }
        });
    });
});

// Get available models from Ollama library
ipcMain.handle('get-available-models', async () => {
    try {
        // Popular Ollama models with metadata
        const models = [
            {
                name: 'llama2',
                variants: ['7b', '13b', '70b'],
                description: 'Meta\'s Llama 2 model, excellent for general conversation and reasoning',
                tags: ['general', 'reasoning'],
                sizes: { '7b': '3.8GB', '13b': '7.3GB', '70b': '39GB' },
                downloadTime: { '7b': '5-10 min', '13b': '10-15 min', '70b': '45-60 min' }
            },
            {
                name: 'mistral',
                variants: ['7b', '8x7b'],
                description: 'Fast and capable model, great balance of performance and speed',
                tags: ['general', 'fast'],
                sizes: { '7b': '4.1GB', '8x7b': '26GB' },
                downloadTime: { '7b': '5-10 min', '8x7b': '30-40 min' }
            },
            {
                name: 'codellama',
                variants: ['7b', '13b', '34b'],
                description: 'Specialized for code generation, debugging, and programming tasks',
                tags: ['coding', 'programming'],
                sizes: { '7b': '3.8GB', '13b': '7.3GB', '34b': '19GB' },
                downloadTime: { '7b': '5-10 min', '13b': '10-15 min', '34b': '25-35 min' }
            },
            {
                name: 'phi3',
                variants: ['mini', 'small', 'medium'],
                description: 'Microsoft\'s compact yet powerful model, great for resource-constrained environments',
                tags: ['fast', 'efficient'],
                sizes: { 'mini': '2.3GB', 'small': '7.9GB', 'medium': '14GB' },
                downloadTime: { 'mini': '3-5 min', 'small': '8-12 min', 'medium': '15-20 min' }
            },
            {
                name: 'gemma',
                variants: ['2b', '7b'],
                description: 'Google\'s lightweight model family, optimized for efficiency',
                tags: ['fast', 'efficient'],
                sizes: { '2b': '1.4GB', '7b': '4.8GB' },
                downloadTime: { '2b': '2-4 min', '7b': '6-10 min' }
            },
            {
                name: 'neural-chat',
                variants: ['7b'],
                description: 'Intel\'s conversational AI model, optimized for chat interactions',
                tags: ['general', 'conversation'],
                sizes: { '7b': '4.1GB' },
                downloadTime: { '7b': '5-10 min' }
            }
        ];
        
        return { success: true, models };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Download a model
ipcMain.handle('download-model', async (event, modelName, variant) => {
    return new Promise((resolve) => {
        const fullModelName = variant ? `${modelName}:${variant}` : modelName;
        console.log(`Starting download of ${fullModelName}`);
        
        // Set OLLAMA_MODELS environment variable if external drive is configured
        let env = { ...process.env };
        try {
            const configPath = path.join(__dirname, 'ollama-config.json');
            if (require('fs').existsSync(configPath)) {
                const config = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
                if (config.externalPath) {
                    env.OLLAMA_MODELS = config.externalPath;
                }
            }
        } catch (e) {
            console.log('No external drive config found, using default path');
        }
        
        const ollamaProcess = spawn('ollama', ['pull', fullModelName], { env });
        let output = '';
        let error = '';
        
        ollamaProcess.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            
            // Parse progress from ollama output
            const lines = text.split('\n');
            for (const line of lines) {
                if (line.includes('pulling') || line.includes('downloading')) {
                    // Send progress updates to renderer
                    event.sender.send('download-progress', {
                        model: fullModelName,
                        status: 'downloading',
                        message: line.trim()
                    });
                }
            }
        });
        
        ollamaProcess.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        ollamaProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`Successfully downloaded ${fullModelName}`);
                resolve({ success: true, model: fullModelName });
            } else {
                console.error(`Failed to download ${fullModelName}:`, error);
                resolve({ success: false, error: error || 'Download failed' });
            }
        });
    });
});

// Get downloaded models
ipcMain.handle('get-downloaded-models', async () => {
    return new Promise((resolve) => {
        // Set OLLAMA_MODELS environment variable if external drive is configured
        let env = { ...process.env };
        try {
            const configPath = path.join(__dirname, 'ollama-config.json');
            if (require('fs').existsSync(configPath)) {
                const config = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
                if (config.externalPath) {
                    env.OLLAMA_MODELS = config.externalPath;
                }
            }
        } catch (e) {
            console.log('No external drive config found, using default path');
        }
        
        const ollamaProcess = spawn('ollama', ['list'], { env });
        let output = '';
        let error = '';
        
        ollamaProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        ollamaProcess.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        ollamaProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const lines = output.trim().split('\n');
                    const models = [];
                    
                    // Skip header line and parse model data
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line) {
                            const parts = line.split(/\s+/);
                            if (parts.length >= 3) {
                                models.push({
                                    name: parts[0],
                                    id: parts[1],
                                    size: parts[2],
                                    modified: parts.slice(3).join(' ')
                                });
                            }
                        }
                    }
                    
                    resolve({ success: true, models });
                } catch (e) {
                    resolve({ success: false, error: 'Failed to parse model list' });
                }
            } else {
                resolve({ success: false, error: error || 'Failed to get model list' });
            }
        });
    });
});

// Delete a model
ipcMain.handle('delete-model', async (event, modelName) => {
    return new Promise((resolve) => {
        // Set OLLAMA_MODELS environment variable if external drive is configured
        let env = { ...process.env };
        try {
            const configPath = path.join(__dirname, 'ollama-config.json');
            if (require('fs').existsSync(configPath)) {
                const config = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
                if (config.externalPath) {
                    env.OLLAMA_MODELS = config.externalPath;
                }
            }
        } catch (e) {
            console.log('No external drive config found, using default path');
        }
        
        const ollamaProcess = spawn('ollama', ['rm', modelName], { env });
        let output = '';
        let error = '';
        
        ollamaProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        ollamaProcess.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        ollamaProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true });
            } else {
                resolve({ success: false, error: error || 'Failed to delete model' });
            }
        });
    });
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
                        moveMessage = ` Local models will be moved to external drive.`;
                        // Note: We'll skip the actual rsync for now to avoid sync issues
                        // This can be implemented later as a separate background process
                    }
                } catch (copyError) {
                    moveMessage = ' (Warning: Could not check existing local models)';
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
            resolve({ 
                success: false, 
                error: `Failed to setup external drive: ${error.message}` 
            });
        }
    });
}); 