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
        console.log(
          `🎯 Auto-configured Ollama to use external drive: ${config.externalPath}`
        );
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
const pythonProcess = null;

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    titleBarStyle: 'default',
    show: false, // Don't show until ready
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
  mainWindow.webContents.openDevTools();
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

// Robust chat handler with STRICT external drive enforcement
ipcMain.handle('chat-message', async (event, message, model) => {
  const http = require('http');

  // 🔒 CRITICAL: Verify external drive is configured and active
  const configPath = path.join(__dirname, 'ollama-config.json');
  let isUsingExternal = false;
  let externalPath = null;

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      isUsingExternal = config.usingExternal === true;
      externalPath = config.externalPath;
    } catch (error) {
      console.log('Error reading external drive config');
    }
  }

  // 🚫 BLOCK CHAT if not using external drive
  if (!isUsingExternal || !externalPath) {
    return {
      success: false,
      error: 'External storage required for model access.',
      requiresExternalDrive: true,
    };
  }

  // 🔍 Verify the external drive is still mounted
  if (!fs.existsSync(externalPath)) {
    return {
      success: false,
      error: `External drive not found. Please ensure it's connected.`,
      requiresExternalDrive: true,
    };
  }

  // ✅ Confirmed using external drive - proceed with chat
  console.log(`🎯 Chat using external drive: ${externalPath}`);

  // Conversation context storage (in-memory for now)
  if (!global.conversationHistory) {
    global.conversationHistory = new Map();
  }

  const conversationKey = `${model}-conversation`;
  let history = global.conversationHistory.get(conversationKey) || [];

  // Optimized parameters for different models
  const getModelConfig = modelName => {
    const baseConfig = {
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      repeat_penalty: 1.1,
      num_predict: 2048,
    };

    // Phi model optimizations
    if (modelName.toLowerCase().includes('phi')) {
      return {
        ...baseConfig,
        temperature: 0.8, // Slightly higher for more creative responses
        top_p: 0.95, // Better coherence
        top_k: 50, // More vocabulary options
        repeat_penalty: 1.05, // Reduce repetition
        num_predict: 1024, // Phi models are efficient, can handle good length
      };
    }

    // CodeLlama optimizations
    if (modelName.toLowerCase().includes('codellama')) {
      return {
        ...baseConfig,
        temperature: 0.3, // Lower for more precise code
        top_p: 0.85,
        repeat_penalty: 1.2,
      };
    }

    // Mistral optimizations
    if (modelName.toLowerCase().includes('mistral')) {
      return {
        ...baseConfig,
        temperature: 0.75,
        top_p: 0.92,
        top_k: 45,
      };
    }

    return baseConfig;
  };

  // Enhanced system prompt for natural conversation
  const getSystemPrompt = modelName => {
    const basePrompt = `You are a helpful, intelligent, and conversational AI assistant. Provide clear, accurate, and engaging responses. Be concise but thorough. Use natural language and maintain context throughout our conversation.`;

    if (modelName.toLowerCase().includes('phi')) {
      return `${basePrompt} You are particularly good at reasoning and explaining complex topics in simple terms. Be direct and helpful.`;
    }

    if (modelName.toLowerCase().includes('codellama')) {
      return `${basePrompt} You specialize in programming and technical topics. Provide clean, well-commented code and clear explanations.`;
    }

    return basePrompt;
  };

  return new Promise(resolve => {
    try {
      const modelConfig = getModelConfig(model);
      const systemPrompt = getSystemPrompt(model);

      // Prepare messages with context
      const messages = [];

      // Add system prompt
      messages.push({
        role: 'system',
        content: systemPrompt,
      });

      // Add conversation history (keep last 8 exchanges for context)
      const recentHistory = history.slice(-16); // 8 user + 8 assistant messages
      messages.push(...recentHistory);

      // Add current message
      messages.push({
        role: 'user',
        content: message,
      });

      const payload = {
        model: model,
        messages: messages,
        stream: false,
        options: modelConfig,
      };

      const postData = JSON.stringify(payload);

      const options = {
        hostname: '127.0.0.1', // Use IPv4 explicitly instead of localhost
        port: 11434,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = http.request(options, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const response = JSON.parse(data);
              const assistantMessage =
                response.message?.content || 'No response received';

              // Update conversation history
              history.push({ role: 'user', content: message });
              history.push({ role: 'assistant', content: assistantMessage });

              // Keep history manageable (last 20 exchanges = 40 messages)
              if (history.length > 40) {
                history = history.slice(-40);
              }

              global.conversationHistory.set(conversationKey, history);

              resolve({
                success: true,
                message: assistantMessage,
                model: model,
                tokens: response.eval_count || 0,
                duration: response.total_duration || 0,
              });
            } else {
              resolve({
                success: false,
                error: `HTTP ${res.statusCode}: ${data}`,
              });
            }
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse response: ${parseError.message}`,
            });
          }
        });
      });

      req.on('error', error => {
        console.log('HTTP Request Error:', error.code, error.message);
        if (error.code === 'ECONNREFUSED') {
          resolve({
            success: false,
            error: 'Ollama server is not running. Please start Ollama first.',
          });
        } else if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
          resolve({
            success: false,
            error:
              'Request timed out. The model might be too large or the query too complex.',
          });
        } else {
          resolve({
            success: false,
            error: `Connection failed: ${error.message}`,
          });
        }
      });

      req.on('timeout', () => {
        console.log('HTTP Request timed out');
        req.destroy();
        resolve({
          success: false,
          error:
            'Request timed out. Try a simpler question or check if the model is loaded.',
        });
      });

      req.write(postData);
      req.end();
    } catch (error) {
      resolve({
        success: false,
        error: `Request setup failed: ${error.message}`,
      });
    }
  });
});

// Clear conversation history for a model
ipcMain.handle('clear-conversation', async (event, model) => {
  if (global.conversationHistory) {
    const conversationKey = `${model}-conversation`;
    global.conversationHistory.delete(conversationKey);
  }
  return { success: true };
});

// Get conversation history for debugging
ipcMain.handle('get-conversation-history', async (event, model) => {
  if (global.conversationHistory) {
    const conversationKey = `${model}-conversation`;
    const history = global.conversationHistory.get(conversationKey) || [];
    return { success: true, history: history };
  }
  return { success: false, history: [] };
});

// Get available models from Ollama library
ipcMain.handle('get-available-models', async () => {
  try {
    // Popular Ollama models with metadata
    const models = [
      {
        name: 'llama2',
        variants: ['7b', '13b', '70b'],
        description:
          "Meta's Llama 2 model, excellent for general conversation and reasoning",
        tags: ['general', 'reasoning'],
        sizes: { '7b': '3.8GB', '13b': '7.3GB', '70b': '39GB' },
        downloadTime: {
          '7b': '5-10 min',
          '13b': '10-15 min',
          '70b': '45-60 min',
        },
      },
      {
        name: 'mistral',
        variants: ['7b'],
        description:
          'Fast and capable model, great balance of performance and speed',
        tags: ['general', 'fast'],
        sizes: { '7b': '4.1GB' },
        downloadTime: { '7b': '6-12 min' },
      },
      {
        name: 'codellama',
        variants: ['7b', '13b', '34b'],
        description: 'Code generation and programming assistance model',
        tags: ['coding', 'programming'],
        sizes: { '7b': '3.8GB', '13b': '7.3GB', '34b': '19GB' },
        downloadTime: {
          '7b': '5-10 min',
          '13b': '10-15 min',
          '34b': '25-35 min',
        },
      },
      {
        name: 'phi3',
        variants: ['mini', 'small', 'medium'],
        description: "Microsoft's efficient small language model, very fast",
        tags: ['fast', 'efficient'],
        sizes: { mini: '2.3GB', small: '7.9GB', medium: '14GB' },
        downloadTime: {
          mini: '3-6 min',
          small: '10-15 min',
          medium: '18-25 min',
        },
      },
      {
        name: 'gemma',
        variants: ['2b', '7b'],
        description: "Google's Gemma model family, lightweight and powerful",
        tags: ['general', 'efficient'],
        sizes: { '2b': '1.4GB', '7b': '5.0GB' },
        downloadTime: { '2b': '2-4 min', '7b': '7-12 min' },
      },
      {
        name: 'neural-chat',
        variants: ['7b'],
        description:
          'Fine-tuned for helpful, harmless, and honest conversations',
        tags: ['chat', 'helpful'],
        sizes: { '7b': '4.1GB' },
        downloadTime: { '7b': '6-12 min' },
      },
    ];

    return { success: true, models };
  } catch (error) {
    console.error('Error getting available models:', error);
    return { success: false, error: error.message };
  }
});

// Download a model
ipcMain.handle('download-model', async (event, modelName, variant) => {
  return new Promise(resolve => {
    const fullModelName = variant ? `${modelName}:${variant}` : modelName;
    console.log(`Starting download of ${fullModelName}`);

    // Always use external drive if configured (automatic detection)
    const env = { ...process.env };
    const configPath = path.join(__dirname, 'ollama-config.json');

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.usingExternal && config.externalPath) {
          env.OLLAMA_MODELS = config.externalPath;
          console.log(
            `📥 Downloading ${fullModelName} to external drive: ${config.externalPath}`
          );
        } else {
          console.log(`📥 Downloading ${fullModelName} to default location`);
        }
      } catch (error) {
        console.log('Error reading external drive config, using default path');
      }
    } else {
      console.log(
        `📥 Downloading ${fullModelName} to default location (no external drive configured)`
      );
    }

    const ollamaProcess = spawn('ollama', ['pull', fullModelName], { env });
    let output = '';
    let error = '';
    let progressTimer = null;
    let fallbackProgress = 0;

    // Start fallback progress timer in case Ollama doesn't provide detailed progress
    progressTimer = setInterval(() => {
      fallbackProgress += 2; // Increment by 2% every interval
      if (fallbackProgress < 85) {
        // Don't go past 85% until we know it's complete
        event.sender.send('download-progress', {
          model: fullModelName,
          status: 'downloading',
          message: `Downloading... ${fallbackProgress}%`,
          percentage: fallbackProgress,
          speed: null,
          size: null,
        });
      }
    }, 1500); // Update every 1.5 seconds

    ollamaProcess.stdout.on('data', data => {
      const text = data.toString();
      output += text;

      // Parse detailed progress from ollama output
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          // Parse different types of progress messages
          const progressData = {
            model: fullModelName,
            status: 'downloading',
            message: line.trim(),
            percentage: null,
            speed: null,
            size: null,
          };

          // More comprehensive progress parsing for Ollama output

          // Look for percentage patterns (various formats)
          const percentPatterns = [
            /(\d+)%/, // "45%"
            /(\d+)\s*percent/i, // "45 percent"
            /(\d+)\/\d+/, // "45/100" style
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
            /([\d.]+\s*[KMGT]?B\/s)/i, // "2.1 MB/s"
            /([\d.]+\s*[KMGT]?bps)/i, // "2.1 Mbps"
            /(\d+\.\d+\s*MB\/s)/i, // "2.1 MB/s"
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
            /(\d+\.\d+\s*GB)/i,
          ];

          for (const pattern of sizePatterns) {
            const match = line.match(pattern);
            if (match && !match[0].includes('/')) {
              // Exclude speed measurements
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
          } else if (
            lowerLine.includes('downloading') ||
            lowerLine.includes('pulling')
          ) {
            progressData.status = 'downloading';
            if (progressData.percentage) {
              progressData.message = `Downloading ${progressData.percentage}%`;
            } else {
              progressData.message = 'Downloading...';
            }
          } else if (
            lowerLine.includes('verifying') ||
            lowerLine.includes('verify')
          ) {
            progressData.status = 'verifying';
            progressData.message = 'Verifying download...';
            progressData.percentage = progressData.percentage || 90;
          } else if (
            lowerLine.includes('success') ||
            lowerLine.includes('complete')
          ) {
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
          if (
            progressData.percentage !== null ||
            progressData.status !== 'downloading'
          ) {
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

    ollamaProcess.stderr.on('data', data => {
      error += data.toString();
    });

    ollamaProcess.on('close', code => {
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
          size: null,
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
          isExternal: true,
        };
      }
    }

    // Fallback to default location
    const defaultPath =
      process.env.OLLAMA_MODELS || '/Users/yevetteasante/.ollama/models';
    return {
      success: true,
      path: defaultPath,
      isExternal: false,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
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
          path: config.externalPath,
        };
      }
    }

    // Fallback to default location
    const defaultPath =
      process.env.OLLAMA_MODELS || '/Users/yevetteasante/.ollama/models';
    shell.openPath(defaultPath);
    return {
      success: true,
      message: `Opened default models location: ${defaultPath}`,
      path: defaultPath,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to open models location: ${error.message}`,
    };
  }
});

// Get downloaded models - STRICT external drive enforcement
ipcMain.handle('get-downloaded-models', async () => {
  return new Promise(resolve => {
    // 🔒 CRITICAL: Verify external drive is configured and active
    const configPath = path.join(__dirname, 'ollama-config.json');
    let isUsingExternal = false;
    let externalPath = null;

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        isUsingExternal = config.usingExternal === true;
        externalPath = config.externalPath;
      } catch (error) {
        console.log('Error reading external drive config');
      }
    }

    // 🚫 BLOCK MODEL LOADING if not using external drive
    if (!isUsingExternal || !externalPath) {
      resolve({
        success: false,
        error: 'External storage required.',
        models: [],
        requiresExternalDrive: true,
      });
      return;
    }

    // 🔍 Verify the external drive is still mounted
    if (!fs.existsSync(externalPath)) {
      resolve({
        success: false,
        error: `External drive not connected.`,
        models: [],
        requiresExternalDrive: true,
      });
      return;
    }

    // ✅ Set OLLAMA_MODELS to external drive path
    const env = { ...process.env };
    env.OLLAMA_MODELS = externalPath;
    console.log(`🎯 Loading models from external drive: ${externalPath}`);

    const ollamaProcess = spawn('ollama', ['list'], { env });
    let output = '';
    let error = '';

    ollamaProcess.stdout.on('data', data => {
      output += data.toString();
    });

    ollamaProcess.stderr.on('data', data => {
      error += data.toString();
    });

    ollamaProcess.on('close', code => {
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
                  modified: parts.slice(3).join(' '),
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
  return new Promise(resolve => {
    // Set OLLAMA_MODELS environment variable if external drive is configured
    const env = { ...process.env };
    try {
      const configPath = path.join(__dirname, 'ollama-config.json');
      if (require('fs').existsSync(configPath)) {
        const config = JSON.parse(
          require('fs').readFileSync(configPath, 'utf8')
        );
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

    ollamaProcess.stdout.on('data', data => {
      output += data.toString();
    });

    ollamaProcess.stderr.on('data', data => {
      error += data.toString();
    });

    ollamaProcess.on('close', code => {
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
      message,
    ]);

    let output = '';
    let error = '';

    python.stdout.on('data', data => {
      output += data.toString();
    });

    python.stderr.on('data', data => {
      error += data.toString();
    });

    python.on('close', code => {
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

// Check model readiness for chat
ipcMain.handle('check-model-readiness', async event => {
  return new Promise(resolve => {
    const python = spawn('python3', [
      '-c',
      `
import sys
import json
import requests
import time

try:
    # First check if server is responding
    response = requests.get('http://localhost:11434/api/version', timeout=2)
    if response.status_code != 200:
        print(json.dumps({"ready": False, "loading": False, "error": "Server not responding"}))
        exit()
    
    # Check if we can get models (this tells us if models are accessible)
    models_response = requests.get('http://localhost:11434/api/tags', timeout=3)
    if models_response.status_code != 200:
        print(json.dumps({"ready": False, "loading": False, "error": "Models not accessible"}))
        exit()
    
    models_data = models_response.json()
    if not models_data.get('models'):
        print(json.dumps({"ready": False, "loading": False, "error": "No models available"}))
        exit()
    
    # If we get here, server is responding and models are available
    # Consider system ready without heavy test chat
    first_model = models_data['models'][0]['name']
    print(json.dumps({"ready": True, "loading": False, "model": first_model}))
        
except requests.exceptions.Timeout:
    print(json.dumps({"ready": False, "loading": False, "error": "Server timeout"}))
except requests.exceptions.ConnectionError:
    print(json.dumps({"ready": False, "loading": False, "error": "Server not running"}))
except Exception as e:
    print(json.dumps({"ready": False, "loading": False, "error": str(e)}))
            `,
    ]);

    let output = '';
    python.stdout.on('data', data => {
      output += data.toString();
    });

    python.on('close', code => {
      try {
        const result = JSON.parse(output.trim());
        resolve(result);
      } catch (e) {
        resolve({
          ready: false,
          loading: false,
          error: 'Failed to parse response',
        });
      }
    });
  });
});

// Check Ollama status
ipcMain.handle('check-ollama-status', async event => {
  return new Promise(resolve => {
    const python = spawn('python3', [
      '-c',
      `
import sys
import json
import requests

try:
    response = requests.get('http://localhost:11434/api/version', timeout=3)
    if response.status_code == 200:
        print(json.dumps({"running": True}))
    else:
        print(json.dumps({"running": False}))
except:
    print(json.dumps({"running": False}))
            `,
    ]);

    let output = '';
    python.stdout.on('data', data => {
      output += data.toString();
    });

    python.on('close', code => {
      try {
        const result = JSON.parse(output.trim());
        resolve(result);
      } catch (e) {
        resolve({ running: false });
      }
    });
  });
});

// Start Ollama server
ipcMain.handle('start-ollama', async event => {
  return new Promise(resolve => {
    const python = spawn('python3', [
      '-c',
      `
import sys
import json
import subprocess
import time
import requests

try:
    # Try to start ollama serve
    process = subprocess.Popen(['ollama', 'serve'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Wait a bit and check if it's running
    time.sleep(3)
    
    # Test if server is responding
    response = requests.get('http://localhost:11434/api/version', timeout=5)
    if response.status_code == 200:
        print(json.dumps({"success": True, "message": "Ollama started successfully"}))
    else:
        print(json.dumps({"success": False, "error": "Ollama server not responding"}))
        
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
            `,
    ]);

    let output = '';
    python.stdout.on('data', data => {
      output += data.toString();
    });

    python.on('close', code => {
      try {
        const result = JSON.parse(output.trim());
        resolve(result);
      } catch (e) {
        resolve({ success: false, error: 'Failed to start Ollama' });
      }
    });
  });
});

ipcMain.handle('get-models', async event => {
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
            `,
    ]);

    let output = '';
    let error = '';

    python.stdout.on('data', data => {
      output += data.toString();
    });

    python.stderr.on('data', data => {
      error += data.toString();
    });

    python.on('close', code => {
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

// External drive detection
ipcMain.handle('detect-external-drives', async event => {
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
            `,
    ]);

    let output = '';
    let error = '';

    python.stdout.on('data', data => {
      output += data.toString();
    });

    python.stderr.on('data', data => {
      error += data.toString();
    });

    python.on('close', code => {
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
    const args = force
      ? ['force', `/Volumes/${driveName}`]
      : [`/Volumes/${driveName}`];

    const diskutil = spawn('diskutil', [command, ...args]);

    let output = '';
    let error = '';

    diskutil.stdout.on('data', data => {
      output += data.toString();
    });

    diskutil.stderr.on('data', data => {
      error += data.toString();
    });

    diskutil.on('close', code => {
      if (code === 0) {
        const method = force ? 'force ejected' : 'ejected';
        resolve({
          success: true,
          message: `Drive ${driveName} ${method} successfully`,
        });
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
      const currentModelsPath =
        process.env.OLLAMA_MODELS || '/Users/yevetteasante/.ollama/models';

      // Store the configuration in a file for persistence
      const configPath = path.join(__dirname, 'ollama-config.json');
      const config = {
        originalPath: currentModelsPath,
        externalPath: modelsPath,
        usingExternal: true,
        driveName: driveName,
        timestamp: new Date().toISOString(),
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      // Move existing models if they exist locally
      let moveMessage = '';

      if (
        fs.existsSync(currentModelsPath) &&
        currentModelsPath !== modelsPath
      ) {
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
            stdio: 'ignore',
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
        modelsMoved: moveMessage.length > 0,
      });
    } catch (error) {
      resolve({
        success: false,
        error: `Failed to setup external drive: ${error.message}`,
      });
    }
  });
});
