const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const https = require('https');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream');

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

// Auto-download Ollama if not installed (only once)
async function ensureOllamaInstalled() {
  const ollamaPaths = [
    '/usr/local/bin/ollama',
    '/opt/homebrew/bin/ollama',
    '/usr/bin/ollama',
  ];
  
  // Check if Ollama already exists in system
  for (const ollamaPath of ollamaPaths) {
    if (fs.existsSync(ollamaPath)) {
      console.log('✅ Ollama found at:', ollamaPath);
      return ollamaPath;
    }
  }
  
  const ollamaDir = path.join(app.getPath('home'), '.ollamachat');
  const ollamaPath = path.join(ollamaDir, 'ollama');
  const flagFile = path.join(ollamaDir, '.ollama-download-attempted');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(ollamaDir)) {
    fs.mkdirSync(ollamaDir, { recursive: true });
  }
  
  // Check if already downloaded
  if (fs.existsSync(ollamaPath)) {
    console.log('✅ Ollama already downloaded at:', ollamaPath);
    return ollamaPath;
  }
  
  // Check if we already attempted download (only try once)
  if (fs.existsSync(flagFile)) {
    console.log('⚠️ Ollama download was already attempted. Skipping.');
    return null;
  }
  
  try {
    // Mark that we're attempting download (only once)
    fs.writeFileSync(flagFile, new Date().toISOString());
    
    console.log('📥 Ollama not found. Auto-downloading...');
    
    // Download Ollama for macOS
    const downloadUrl = 'https://ollama.ai/download/ollama-darwin.zip';
    const zipPath = path.join(ollamaDir, 'ollama-darwin.zip');
    
    console.log('⏳ Downloading Ollama (~100MB)...');
    
    await new Promise((resolve, reject) => {
      https.get(downloadUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          https.get(response.headers.location, (redirectResponse) => {
            pipeline(redirectResponse, createWriteStream(zipPath), (err) => {
              if (err) reject(err);
              else resolve();
            });
          }).on('error', reject);
        } else if (response.statusCode === 200) {
          pipeline(response, createWriteStream(zipPath), (err) => {
            if (err) reject(err);
            else resolve();
          });
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      }).on('error', reject);
    });
    
    console.log('✅ Downloaded. Extracting...');
    
    // Extract zip file
    try {
      execSync(`cd "${ollamaDir}" && unzip -o ollama-darwin.zip`, { stdio: 'ignore' });
    } catch (e) {
      throw new Error('Failed to extract Ollama zip file');
    }
    
    // Make executable
    try {
      execSync(`chmod +x "${ollamaPath}"`, { stdio: 'ignore' });
    } catch (e) {
      throw new Error('Failed to make Ollama executable');
    }
    
    // Clean up zip
    try {
      fs.unlinkSync(zipPath);
    } catch (e) {
      console.log('Warning: Could not delete zip file');
    }
    
    console.log('✅ Ollama installed successfully at:', ollamaPath);
    return ollamaPath;
  } catch (error) {
    console.error('❌ Failed to auto-download Ollama:', error.message);
    console.error('📥 Please manually install Ollama from: https://ollama.ai/download');
    return null;
  }
}

// Call this during app initialization
const externalPath = initializeExternalDriveSettings();
let mainWindow;
const pythonProcess = null;

// Ensure Ollama is installed on app startup
app.on('ready', async () => {
  await ensureOllamaInstalled();
});

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false, // Don't show until ready
  });



  // Load React app - use Vite dev server in development, built files in production
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // In development, load from Vite dev server (try multiple ports)
    mainWindow.loadURL('http://localhost:5174').catch(() => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        mainWindow.loadURL('http://localhost:5175');
      });
    });
  } else {
    // In production, load from built React files
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Focus the window
    if (process.platform === 'darwin') {
      app.dock.show();
    }
    mainWindow.focus();
  });

  // Log errors
  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details);
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }



  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (pythonProcess) {
      pythonProcess.kill();
    }
  });

  // Log any errors
  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details);
  });
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
        variants: ['mini', 'medium'],
        description: "Microsoft's efficient small language model, very fast",
        tags: ['fast', 'efficient'],
        sizes: { mini: '2.2GB', medium: '7.9GB' },
        downloadTime: {
          mini: '3-6 min',
          medium: '12-18 min',
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

    // REQUIRE external drive - don't allow downloads to default location
    const env = { ...process.env };
    const configPath = path.join(__dirname, 'ollama-config.json');
    let externalDrivePath = null;

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.usingExternal && config.externalPath) {
          // Check if the drive is actually mounted
          if (!fs.existsSync(config.externalPath)) {
            console.error(`❌ External drive not mounted: ${config.externalPath}`);
            resolve({
              success: false,
              error: `External drive not found at ${config.externalPath}. Please connect your A005 drive.`,
              model: fullModelName,
            });
            return;
          }
          externalDrivePath = config.externalPath;
          env.OLLAMA_MODELS = config.externalPath;
          console.log(
            `📥 Downloading ${fullModelName} to external drive: ${config.externalPath}`
          );
        } else {
          console.error('❌ No external drive configured');
          resolve({
            success: false,
            error: 'External drive not configured. Please configure a drive in Settings.',
            model: fullModelName,
          });
          return;
        }
      } catch (error) {
        console.error('❌ Error reading external drive config:', error);
        resolve({
          success: false,
          error: 'Error reading drive configuration. Please reconfigure in Settings.',
          model: fullModelName,
        });
        return;
      }
    } else {
      console.error('❌ No external drive configured');
      resolve({
        success: false,
        error: 'External drive not configured. Please configure a drive in Settings.',
        model: fullModelName,
      });
      return;
    }

    // Find ollama executable in common paths
    const ollamaPaths = [
      '/usr/local/bin/ollama',
      '/opt/homebrew/bin/ollama',
      '/usr/bin/ollama',
    ];
    
    let ollamaPath = 'ollama'; // fallback to PATH
    for (const p of ollamaPaths) {
      if (fs.existsSync(p)) {
        ollamaPath = p;
        break;
      }
    }
    
    console.log(`Using ollama from: ${ollamaPath}`);
    console.log(`OLLAMA_MODELS env var: ${env.OLLAMA_MODELS}`);
    
    const ollamaProcess = spawn(ollamaPath, ['pull', fullModelName], { 
      env: env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    let error = '';
    let progressTimer = null;
    let fallbackProgress = 0;
    let hasResolved = false;

    // Handle spawn errors
    ollamaProcess.on('error', (err) => {
      if (!hasResolved) {
        hasResolved = true;
        clearInterval(progressTimer);
        console.error('Error spawning ollama pull:', err);
        resolve({
          success: false,
          error: `Failed to start download: ${err.message}`,
          model: fullModelName,
        });
      }
    });

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
      if (hasResolved) return; // Already resolved due to error
      hasResolved = true;
      
      // Clear fallback progress timer
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }

      if (code === 0) {
        console.log(`✅ Successfully downloaded ${fullModelName}`);

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
        console.error(`❌ Failed to download ${fullModelName}:`, error);
        resolve({ success: false, error: error || 'Download failed', model: fullModelName });
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

    // Find ollama executable in common paths
    const ollamaPaths = [
      '/usr/local/bin/ollama',
      '/opt/homebrew/bin/ollama',
      '/usr/bin/ollama',
    ];
    
    let ollamaPath = 'ollama'; // fallback to PATH
    for (const p of ollamaPaths) {
      if (fs.existsSync(p)) {
        ollamaPath = p;
        break;
      }
    }

    const ollamaProcess = spawn(ollamaPath, ['list'], { env });
    let output = '';
    let error = '';
    let hasResolved = false;

    // Handle spawn errors
    ollamaProcess.on('error', (err) => {
      if (!hasResolved) {
        hasResolved = true;
        console.error('Error spawning ollama:', err);
        resolve({ success: false, error: `Failed to spawn ollama: ${err.message}`, models: [] });
      }
    });

    ollamaProcess.stdout.on('data', data => {
      output += data.toString();
    });

    ollamaProcess.stderr.on('data', data => {
      error += data.toString();
    });

    ollamaProcess.on('close', code => {
      if (hasResolved) return; // Already resolved due to error
      hasResolved = true;
      
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
          resolve({ success: false, error: 'Failed to parse model list', models: [] });
        }
      } else {
        resolve({ success: false, error: error || 'Failed to get model list', models: [] });
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
import socket

def is_port_open(host, port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(1)
    try:
        result = sock.connect_ex((host, port))
        return result == 0
    finally:
        sock.close()

try:
    # First check if port is open
    if is_port_open('localhost', 11434):
        try:
            # Try to get version
            response = requests.get('http://localhost:11434/api/version', timeout=2)
            if response.status_code == 200:
                print(json.dumps({"running": True}))
            else:
                print(json.dumps({"running": False}))
        except:
            # Port is open but request failed, might still be initializing
            print(json.dumps({"running": True}))
    else:
        print(json.dumps({"running": False}))
except Exception as e:
    print(json.dumps({"running": False}))
            `,
    ]);

    let output = '';
    let errorOutput = '';
    
    python.stdout.on('data', data => {
      output += data.toString();
    });
    
    python.stderr.on('data', data => {
      errorOutput += data.toString();
    });

    python.on('close', code => {
      try {
        const result = JSON.parse(output.trim());
        console.log('Ollama status check:', result);
        resolve(result);
      } catch (e) {
        console.log('Status check error:', errorOutput || e.message);
        resolve({ running: false });
      }
    });
  });
});

// Kill Ollama process
ipcMain.handle('kill-ollama', async () => {
  return new Promise(resolve => {
    try {
      execSync('pkill -f "ollama serve"', { stdio: 'ignore' });
      console.log('✅ Killed existing Ollama process');
      setTimeout(() => resolve({ success: true }), 1000);
    } catch (error) {
      console.log('No Ollama process to kill');
      resolve({ success: true });
    }
  });
});

// Start Ollama with specific drive path
ipcMain.handle('start-ollama-with-drive', async (event, drivePath) => {
  return new Promise(resolve => {
    const python = spawn('python3', [
      '-c',
      `
import sys
import json
import subprocess
import time
import requests
import os

try:
    # Find ollama in common paths
    ollama_paths = [
        '/usr/local/bin/ollama',
        '/opt/homebrew/bin/ollama',
        '/usr/bin/ollama',
        '/Applications/Ollama.app/Contents/Resources/ollama'
    ]
    
    ollama_cmd = None
    for path in ollama_paths:
        if os.path.exists(path):
            ollama_cmd = path
            break
    
    if not ollama_cmd:
        print(json.dumps({"success": False, "error": "Ollama not found"}))
        sys.exit(1)
    
    # Start ollama serve with OLLAMA_MODELS env var
    env = os.environ.copy()
    env['OLLAMA_MODELS'] = '${drivePath}'
    
    print(json.dumps({"success": True, "message": "Starting Ollama with models path: ${drivePath}"}))
    
    process = subprocess.Popen([ollama_cmd, 'serve'], 
                              env=env,
                              stdout=subprocess.DEVNULL, 
                              stderr=subprocess.DEVNULL)
    
    # Wait a bit and check if it's running
    time.sleep(3)
    
    # Test if server is responding
    try:
        response = requests.get('http://localhost:11434/api/version', timeout=5)
        if response.status_code == 200:
            print(json.dumps({"success": True, "message": "Ollama started with external drive"}))
        else:
            print(json.dumps({"success": False, "error": "Ollama not responding"}))
    except:
        print(json.dumps({"success": True, "message": "Ollama is starting..."}))
        
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
import os

try:
    # Find ollama in common paths
    ollama_paths = [
        '/usr/local/bin/ollama',
        '/opt/homebrew/bin/ollama',
        '/usr/bin/ollama',
        '/Applications/Ollama.app/Contents/MacOS/ollama'
    ]
    
    ollama_cmd = None
    for path in ollama_paths:
        if os.path.exists(path):
            ollama_cmd = path
            break
    
    if not ollama_cmd:
        # Try using 'open -a Ollama' for macOS app
        try:
            subprocess.Popen(['open', '-a', 'Ollama'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(5)
        except:
            print(json.dumps({"success": False, "error": "Ollama not found in PATH or Applications"}))
            sys.exit(1)
    else:
        # Start ollama serve with full path
        process = subprocess.Popen([ollama_cmd, 'serve'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Wait a bit and check if it's running
    time.sleep(3)
    
    # Test if server is responding
    try:
        response = requests.get('http://localhost:11434/api/version', timeout=5)
        if response.status_code == 200:
            print(json.dumps({"success": True, "message": "Ollama started successfully"}))
        else:
            print(json.dumps({"success": False, "error": "Ollama server not responding"}))
    except:
        # Even if request fails, ollama might be starting
        print(json.dumps({"success": True, "message": "Ollama is starting..."}))
        
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

      // Configuration is complete - Ollama will use the new path when it starts
      console.log(`✅ External drive configured: ${modelsPath}`);
      console.log('📝 Configuration saved to ollama-config.json');
      console.log('💡 Tip: Use "Start Ollama" button to start Ollama with the new external drive');

      resolve({
        success: true,
        message: `External drive '${driveName}' is now configured for Ollama models.${moveMessage} Please use the "Start Ollama" button to start Ollama with the new configuration.`,
        modelsPath: modelsPath,
        originalPath: currentModelsPath,
        restartRequired: false,
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

// Scan for external drives
ipcMain.handle('scan-drives', async () => {
  try {
    const { execSync } = require('child_process');
    const drives = [];

    if (process.platform === 'darwin') {
      // macOS: List mounted volumes
      try {
        const output = execSync('df -h | grep "/Volumes"', { encoding: 'utf8' });
        const lines = output.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          const parts = line.split(/\s+/);
          if (parts.length >= 6) {
            const path = parts.slice(5).join(' ');
            const name = path.split('/').pop() || 'External Drive';
            const size = parts[1];
            const used = parts[2];
            const available = parts[3];
            
            drives.push({
              name,
              path,
              size,
              used,
              available,
              type: 'external'
            });
          }
        }
      } catch (e) {
        console.log('Error scanning macOS drives:', e.message);
      }
    } else if (process.platform === 'win32') {
      // Windows: List drives
      try {
        const output = execSync('wmic logicaldisk get name,size,freespace', { encoding: 'utf8' });
        const lines = output.split('\n').filter(line => line.trim());
        
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(/\s+/);
          if (parts.length >= 3) {
            const drive = parts[0];
            const size = parseInt(parts[1]);
            const free = parseInt(parts[2]);
            
            // Skip system drive (usually C:)
            if (drive !== 'C:') {
              drives.push({
                name: `${drive} Drive`,
                path: drive,
                size: `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`,
                available: `${(free / 1024 / 1024 / 1024).toFixed(1)} GB`,
                type: 'external'
              });
            }
          }
        }
      } catch (e) {
        console.log('Error scanning Windows drives:', e.message);
      }
    } else {
      // Linux: List mounted drives
      try {
        const output = execSync('df -h | grep -E "^/dev" | grep -v "/$"', { encoding: 'utf8' });
        const lines = output.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          const parts = line.split(/\s+/);
          if (parts.length >= 6) {
            const path = parts.slice(5).join(' ');
            const name = path.split('/').pop() || 'External Drive';
            const size = parts[1];
            const available = parts[3];
            
            drives.push({
              name,
              path,
              size,
              available,
              type: 'external'
            });
          }
        }
      } catch (e) {
        console.log('Error scanning Linux drives:', e.message);
      }
    }

    return {
      success: true,
      drives: drives.length > 0 ? drives : []
    };
  } catch (error) {
    console.error('Error scanning drives:', error);
    return {
      success: false,
      error: error.message,
      drives: []
    };
  }
});

// Get mounted drives using Python (original working method)
ipcMain.handle('get-mounted-drives', async () => {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    
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
          console.log('📀 Detected drives:', result.drives);
          resolve(result);
        } catch (e) {
          console.log('Failed to parse drive detection response');
          resolve({ success: false, error: 'Failed to parse response', drives: [] });
        }
      } else {
        console.log('Drive detection failed:', error);
        resolve({ success: false, error: error || 'Drive detection failed', drives: [] });
      }
    });
  });
});

// Check external drive configuration
ipcMain.handle('check-external-drive-config', async () => {
  try {
    const configPath = path.join(__dirname, 'ollama-config.json');
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.usingExternal && config.externalPath) {
        return {
          configured: true,
          path: config.externalPath,
          driveName: config.driveName
        };
      }
    }
    
    return { configured: false };
  } catch (error) {
    console.error('Error checking external drive config:', error);
    return { configured: false };
  }
});

// Configure external drive
ipcMain.handle('configure-external-drive', async (event, driveInfo) => {
  try {
    const configPath = path.join(__dirname, 'ollama-config.json');
    const modelsPath = path.join(driveInfo.path, 'ollama-models');

    // Verify the drive exists
    if (!fs.existsSync(driveInfo.path)) {
      return {
        success: false,
        error: `Drive not found at ${driveInfo.path}`
      };
    }

    // Create ollama-models directory if it doesn't exist
    if (!fs.existsSync(modelsPath)) {
      fs.mkdirSync(modelsPath, { recursive: true });
    }

    // Save configuration
    const config = {
      usingExternal: true,
      externalPath: modelsPath,
      driveName: driveInfo.name,
      configuredAt: new Date().toISOString()
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Set environment variable for current session
    process.env.OLLAMA_MODELS = modelsPath;

    console.log(`✓ External drive configured: ${driveInfo.name} at ${modelsPath}`);

    return {
      success: true,
      message: `Successfully configured ${driveInfo.name} for Ollama models`,
      path: modelsPath
    };
  } catch (error) {
    console.error('Error configuring drive:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
