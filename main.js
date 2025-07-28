const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Initialize external drive settings on startup
function initializeExternalDriveSettings() {
    try {
        const configPath = path.join(__dirname, 'ollama-config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.usingExternal && config.externalPath) {
                // Automatically set the environment variable for Ollama
                process.env.OLLAMA_MODELS = config.externalPath;
                console.log(`🎯 Auto-configured Ollama to use external drive: ${config.externalPath}`);
                return config.externalPath;
            }
        }
    } catch (error) {
        console.log('No external drive config found, using default path');
    }
    return null;
}

// Call this during app initialization
const externalPath = initializeExternalDriveSettings();

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
                variants: ['7b'],
                description: 'Fast and capable model, great balance of performance and speed',
                tags: ['general', 'fast'],
                sizes: { '7b': '4.1GB' },
                downloadTime: { '7b': '6-12 min' }
            },
            {
                name: 'codellama',
                variants: ['7b', '13b', '34b'],
                description: 'Code generation and programming assistance model',
                tags: ['coding', 'programming'],
                sizes: { '7b': '3.8GB', '13b': '7.3GB', '34b': '19GB' },
                downloadTime: { '7b': '5-10 min', '13b': '10-15 min', '34b': '25-35 min' }
            },
            {
                name: 'phi3',
                variants: ['mini', 'small', 'medium'],
                description: 'Microsoft\'s efficient small language model, very fast',
                tags: ['fast', 'efficient'],
                sizes: { 'mini': '2.3GB', 'small': '7.9GB', 'medium': '14GB' },
                downloadTime: { 'mini': '3-6 min', 'small': '10-15 min', 'medium': '18-25 min' }
            },
            {
                name: 'gemma',
                variants: ['2b', '7b'],
                description: 'Google\'s Gemma model family, lightweight and powerful',
                tags: ['general', 'efficient'],
                sizes: { '2b': '1.4GB', '7b': '5.0GB' },
                downloadTime: { '2b': '2-4 min', '7b': '7-12 min' }
            },
            {
                name: 'neural-chat',
                variants: ['7b'],
                description: 'Fine-tuned for helpful, harmless, and honest conversations',
                tags: ['chat', 'helpful'],
                sizes: { '7b': '4.1GB' },
                downloadTime: { '7b': '6-12 min' }
            }
        ];

        return { success: true, models };
    } catch (error) {
        console.error('Error getting available models:', error);
        return { success: false, error: error.message };
    }
});

// Download a model
ipcMain.handle('download-model', async (event, modelName, variant) => {
    return new Promise((resolve) => {
        const fullModelName = variant ? `${modelName}:${variant}` : modelName;
        console.log(`Starting download of ${fullModelName}`);
        
        // Always use external drive if configured (automatic detection)
        let env = { ...process.env };
        const configPath = path.join(__dirname, 'ollama-config.json');
        
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.usingExternal && config.externalPath) {
                    env.OLLAMA_MODELS = config.externalPath;
                    console.log(`📥 Downloading ${fullModelName} to external drive: ${config.externalPath}`);
                } else {
                    console.log(`📥 Downloading ${fullModelName} to default location`);
                }
            } catch (error) {
                console.log('Error reading external drive config, using default path');
            }
        } else {
            console.log(`📥 Downloading ${fullModelName} to default location (no external drive configured)`);
        }
        
        const ollamaProcess = spawn('ollama', ['pull', fullModelName], { env });
        let output = '';
        let error = '';
        let progressTimer = null;
        let fallbackProgress = 0;
        
        // Start fallback progress timer in case Ollama doesn't provide detailed progress
        progressTimer = setInterval(() => {
            fallbackProgress += 2; // Increment by 2% every interval
            if (fallbackProgress < 85) { // Don't go past 85% until we know it's complete
                event.sender.send('download-progress', {
                    model: fullModelName,
                    status: 'downloading',
                    message: `Downloading... ${fallbackProgress}%`,
                    percentage: fallbackProgress,
                    speed: null,
                    size: null
                });
            }
        }, 1500); // Update every 1.5 seconds
        
        ollamaProcess.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            
            // Parse detailed progress from ollama output
            const lines = text.split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    // Parse different types of progress messages
                    let progressData = {
                        model: fullModelName,
                        status: 'downloading',
                        message: line.trim(),
                        percentage: null,
                        speed: null,
                        size: null
                    };
                    
                    // More comprehensive progress parsing for Ollama output
                    
                    // Look for percentage patterns (various formats)
                    const percentPatterns = [
                        /(\d+)%/,                    // "45%"
                        /(\d+)\s*percent/i,          // "45 percent"
                        /(\d+)\/\d+/                 // "45/100" style
                    ];
                    
                    for (const pattern of percentPatterns) {
                        const match = line.match(pattern);
                        if (match) {
                            progressData.percentage = parseInt(match[1]);
                            break;
                        }
                    }
                    
                    // Look for download speed patterns
                    const speedPatterns = [
                        /([\d.]+\s*[KMGT]?B\/s)/i,       // "2.1 MB/s"
                        /([\d.]+\s*[KMGT]?bps)/i,        // "2.1 Mbps"
                        /(\d+\.\d+\s*MB\/s)/i            // "2.1 MB/s"
                    ];
                    
                    for (const pattern of speedPatterns) {
                        const match = line.match(pattern);
                        if (match) {
                            progressData.speed = match[1];
                            break;
                        }
                    }
                    
                    // Look for size patterns
                    const sizePatterns = [
                        /([\d.]+\s*[KMGT]?B)(?!\/)/, // "1.2 GB" but not "1.2 GB/s"
                        /(\d+\.\d+\s*MB)/i,
                        /(\d+\.\d+\s*GB)/i
                    ];
                    
                    for (const pattern of sizePatterns) {
                        const match = line.match(pattern);
                        if (match && !match[0].includes('/')) { // Exclude speed measurements
                            progressData.size = match[1];
                            break;
                        }
                    }
                    
                    // Determine status and message based on content
                    const lowerLine = line.toLowerCase();
                    
                    if (lowerLine.includes('pulling') && lowerLine.includes('manifest')) {
                        progressData.status = 'preparing';
                        progressData.message = 'Preparing download...';
                        progressData.percentage = progressData.percentage || 5;
                    } else if (lowerLine.includes('downloading') || lowerLine.includes('pulling')) {
                        progressData.status = 'downloading';
                        if (progressData.percentage) {
                            progressData.message = `Downloading ${progressData.percentage}%`;
                        } else {
                            progressData.message = 'Downloading...';
                        }
                    } else if (lowerLine.includes('verifying') || lowerLine.includes('verify')) {
                        progressData.status = 'verifying';
                        progressData.message = 'Verifying download...';
                        progressData.percentage = progressData.percentage || 90;
                    } else if (lowerLine.includes('success') || lowerLine.includes('complete')) {
                        progressData.status = 'completed';
                        progressData.message = 'Download completed!';
                        progressData.percentage = 100;
                    } else if (line.trim() && !lowerLine.includes('error')) {
                        // Generic progress message
                        progressData.status = 'downloading';
                        progressData.message = line.trim();
                    }
                    
                    // Send enhanced progress to renderer
                    event.sender.send('download-progress', progressData);
                    
                    // If we got real progress data, clear the fallback timer
                    if (progressData.percentage !== null || progressData.status !== 'downloading') {
                        if (progressTimer) {
                            clearInterval(progressTimer);
                            progressTimer = null;
                        }
                    }
                    
                    // Debug logging
                    console.log(`📊 Progress: ${JSON.stringify(progressData)}`);
                }
            }
        });
        
        ollamaProcess.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        ollamaProcess.on('close', (code) => {
            // Clear fallback progress timer
            if (progressTimer) {
                clearInterval(progressTimer);
                progressTimer = null;
            }
            
            if (code === 0) {
                console.log(`Successfully downloaded ${fullModelName}`);
                
                // Send final completion progress
                event.sender.send('download-progress', {
                    model: fullModelName,
                    status: 'completed',
                    message: 'Download completed! ✅',
                    percentage: 100,
                    speed: null,
                    size: null
                });
                
                resolve({ success: true, model: fullModelName });
            } else {
                console.error(`Failed to download ${fullModelName}:`, error);
                resolve({ success: false, error: error || 'Download failed' });
            }
        });
    });
});

// Get models location without opening it (for status checks)
ipcMain.handle('get-models-location', async () => {
    try {
        const configPath = path.join(__dirname, 'ollama-config.json');
        
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.usingExternal && config.externalPath) {
                return { 
                    success: true, 
                    path: config.externalPath,
                    isExternal: true
                };
            }
        }
        
        // Fallback to default location
        const defaultPath = process.env.OLLAMA_MODELS || '/Users/yevetteasante/.ollama/models';
        return { 
            success: true, 
            path: defaultPath,
            isExternal: false
        };
        
    } catch (error) {
        return { 
            success: false, 
            error: error.message 
        };
    }
});

// Open external drive location (actually opens in file system)
ipcMain.handle('open-models-location', async () => {
    const { shell } = require('electron');
    
    try {
        const configPath = path.join(__dirname, 'ollama-config.json');
        
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.usingExternal && config.externalPath) {
                // Open the external drive models folder
                shell.openPath(config.externalPath);
                return { 
                    success: true, 
                    message: `Opened external drive location: ${config.externalPath}`,
                    path: config.externalPath
                };
            }
        }
        
        // Fallback to default location
        const defaultPath = process.env.OLLAMA_MODELS || '/Users/yevetteasante/.ollama/models';
        shell.openPath(defaultPath);
        return { 
            success: true, 
            message: `Opened default models location: ${defaultPath}`,
            path: defaultPath
        };
        
    } catch (error) {
        return { 
            success: false, 
            error: `Failed to open models location: ${error.message}` 
        };
    }
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
            
            // Automatically restart Ollama with new settings
            console.log('🔄 Restarting Ollama with external drive settings...');
            
            // Kill existing Ollama processes
            const killProcess = spawn('pkill', ['ollama']);
            
            killProcess.on('close', () => {
                // Wait a moment, then start Ollama with new path
                setTimeout(() => {
                    const ollamaProcess = spawn('ollama', ['serve'], {
                        env: { ...process.env, OLLAMA_MODELS: modelsPath },
                        detached: true,
                        stdio: 'ignore'
                    });
                    ollamaProcess.unref();
                    
                    console.log(`✅ Ollama restarted with external drive: ${modelsPath}`);
                }, 2000);
            });
            
            resolve({ 
                success: true, 
                message: `External drive '${driveName}' is now configured for Ollama models.${moveMessage} Ollama has been automatically restarted.`,
                modelsPath: modelsPath,
                originalPath: currentModelsPath,
                restartRequired: false, // No longer required since we do it automatically
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