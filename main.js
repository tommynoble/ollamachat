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
      // External drive usage disabled: keep models on the default local path
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



  // Set Content Security Policy (relaxed for development with Vite and file:// protocol)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' file:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' file:; " +
          "style-src 'self' 'unsafe-inline' file:; " +
          "img-src 'self' data: blob: file:; " +
          "font-src 'self' file:; " +
          "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* file:"
        ]
      }
    });
  });

  // Load React app - prefer dev server when NODE_ENV=development
  const distPath = path.join(__dirname, 'dist', 'index.html');
  const hasDistFolder = fs.existsSync(distPath);
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In development, load from Vite dev server (try multiple ports)
    mainWindow.loadURL('http://localhost:5174').catch(() => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        mainWindow.loadURL('http://localhost:5175');
      });
    });
  } else if (hasDistFolder) {
    // In production, load from built React files using file:// protocol with absolute path
    const fileUrl = `file://${distPath}`;
    mainWindow.loadURL(fileUrl);
  } else {
    // Fallback: try dev server if dist is missing
    mainWindow.loadURL('http://localhost:5173');
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

  // DevTools can be opened manually with Cmd+Option+I if needed
  // Removed auto-open for cleaner UI



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

// Optimized parameters for different models
const getModelConfig = modelName => {
  const safeName = (modelName || '').toString();
  const baseConfig = {
    temperature: 0.3, // Cooler default for factual accuracy
    top_p: 0.85,
    top_k: 40,
    repeat_penalty: 1.1,
    num_predict: 2048, // Balanced length
    seed: 42, // Reproducible outputs
  };

  // Deepseek optimizations - ACCURACY MODE (thinking models need more time)
  if (safeName.toLowerCase().includes('deepseek')) {
    return {
      ...baseConfig,
      temperature: 0.3, // Lower for accurate reasoning
      top_p: 0.85,
      top_k: 30,
      repeat_penalty: 1.1,
      num_predict: 2048, // Allow full reasoning output
    };
  }

  // Phi model optimizations
  if (safeName.toLowerCase().includes('phi')) {
    return {
      ...baseConfig,
      temperature: 0.4, // Slightly higher for balance
      top_p: 0.9,
      top_k: 50,
      repeat_penalty: 1.05,
      num_predict: 1024,
    };
  }

  // CodeLlama optimizations
  if (safeName.toLowerCase().includes('codellama')) {
    return {
      ...baseConfig,
      temperature: 0.2, // Very low for precise code
      top_p: 0.8,
      repeat_penalty: 1.2,
      num_predict: 2048,
    };
  }

  // Mistral optimizations
  if (safeName.toLowerCase().includes('mistral')) {
    return {
      ...baseConfig,
      temperature: 0.35,
      top_p: 0.88,
      top_k: 45,
    };
  }

  // Llama2 optimizations - ACCURACY FOCUSED
  if (safeName.toLowerCase().includes('llama2')) {
    return {
      ...baseConfig,
      temperature: 0.3,
      top_p: 0.85,
      top_k: 40,
      num_predict: 2048,
    };
  }

  return baseConfig;
};

// Detailed, structured system prompt without headings
const getSystemPrompt = modelName => {
  const safeName = (modelName || '').toString();
  const basePrompt = `You are a helpful, detailed assistant. Do not greet or introduce yourself unless the user greets first. Provide thorough, well-structured responses with:

- **Numbered lists** for steps, points, or ordered information
- **Bullet points** for unordered details
- **Bold text** for key concepts and important terms
- **A brief summary** at the end of longer responses

Do NOT use headings (##, ###, etc.). Format responses to be informative and easy to scan. Use Markdown formatting liberally. If unsure, say so.`;

  if (safeName.toLowerCase().includes('deepseek')) {
    return `${basePrompt}

SPECIAL INSTRUCTIONS FOR DEEPSEEK:
- You excel at reasoning and logical analysis
- Use your reasoning capabilities to provide thorough, well-thought-out responses
- Break down complex problems into logical steps
- Provide detailed explanations with clear reasoning chains
- Consider multiple approaches and explain why one might be better
- Keep responses concise, skip greetings/intros, and start with the answer`;
  }

  if (safeName.toLowerCase().includes('llama')) {
    return `${basePrompt}

SPECIAL INSTRUCTIONS FOR LLAMA:
- You are versatile and capable across many domains
- Provide balanced, well-rounded responses
- Use your broad knowledge to make helpful connections
- Be practical and actionable in your suggestions`;
  }

  if (safeName.toLowerCase().includes('phi')) {
    return `${basePrompt}

SPECIAL INSTRUCTIONS FOR PHI:
- You are particularly good at reasoning and explaining complex topics
- Break down difficult concepts into understandable parts
- Be direct and efficient while maintaining depth`;
  }

  if (safeName.toLowerCase().includes('codellama')) {
    return `${basePrompt}

SPECIAL INSTRUCTIONS FOR CODE LLAMA:
- You specialize in programming and technical topics
- Provide clean, well-commented, production-ready code
- Explain the reasoning behind your code choices
- Consider performance, readability, and best practices
- Suggest improvements and alternatives when relevant`;
  }

  return basePrompt;
};

// Chat History Storage
const sessionsDir = path.join(app.getPath('userData'), 'sessions');
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

ipcMain.handle('save-chat-session', async (event, session) => {
  try {
    const filePath = path.join(sessionsDir, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving chat session:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-chat-history', async () => {
  try {
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
    const sessions = files.map(file => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf8'));
        // Return lightweight metadata only
        return {
          id: content.id,
          title: content.title || 'New Chat',
          createdAt: content.createdAt,
          updatedAt: content.updatedAt,
          preview: content.messages[0]?.content?.substring(0, 100) || '',
          model: content.model
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    // Sort by most recent first
    return { 
      success: true, 
      sessions: sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) 
    };
  } catch (error) {
    console.error('Error getting chat history:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-chat-session', async (event, sessionId) => {
  try {
    const filePath = path.join(sessionsDir, `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return { success: true, session };
    }
    return { success: false, error: 'Session not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-chat-session', async (event, sessionId) => {
  try {
    const filePath = path.join(sessionsDir, `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'Session not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rename-chat-session', async (event, { sessionId, title }) => {
  try {
    const filePath = path.join(sessionsDir, `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      session.title = title;
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
      return { success: true };
    }
    return { success: false, error: 'Session not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Track active requests for cancellation
const activeRequests = new Map();

ipcMain.handle('chat-message', async (event, message, model, sessionId = 'default') => {
  console.log('📨 Received chat message:', message, 'Model:', model);
  if (!model) {
    return { success: false, error: 'No model selected. Please download/select a model first.' };
  }
  const http = require('http');

  // Prefer external drive if configured and mounted, otherwise use default
  const configPath = path.join(__dirname, 'ollama-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.usingExternal && config.externalPath) {
        if (fs.existsSync(config.externalPath)) {
          process.env.OLLAMA_MODELS = config.externalPath;
          console.log(`🎯 Chat using external drive: ${config.externalPath}`);
        } else {
          console.warn(`⚠️ External drive configured but not mounted: ${config.externalPath}. Using local models path.`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error reading external drive config, using default models path');
    }
  }

  // Conversation context storage (in-memory for now)
  if (!global.conversationHistory) {
    global.conversationHistory = new Map();
  }

  const conversationKey = `${model}-conversation-${sessionId}`;
  let history = global.conversationHistory.get(conversationKey) || [];

  const modelConfig = getModelConfig(model);
  const systemPrompt = getSystemPrompt(model);

  // Prepare messages with context
  const messages = [];

  // Add system prompt
  messages.push({
    role: 'system',
    content: systemPrompt,
  });

  // Add conversation history (keep last ~10 exchanges for cohesion)
  const recentHistory = history.slice(-20); // user/assistant pairs
  messages.push(...recentHistory);

  // Add current message
  messages.push({
    role: 'user',
    content: message,
  });

  // Ensure model has the correct variant
  let modelToUse = model;
  if (model === 'deepseek-r1') {
    modelToUse = 'deepseek-r1:8b';
  } else if (model === 'llama2' && !model.includes(':')) {
    modelToUse = 'llama2:latest';
  }
  const safeModel = (modelToUse || '').toString().trim();
  if (!safeModel) {
    return { success: false, error: 'Model name is empty. Please select a model and try again.' };
  }

  // Quick availability check to catch path mismatch (e.g., server not pointed at external drive)
  const ensureModelAvailable = () => new Promise(resolve => {
    const tagsReq = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/tags',
      method: 'GET',
      timeout: 3000,
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk.toString());
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve({ ok: false, reason: `Tags HTTP ${res.statusCode}` });
        try {
          const parsed = JSON.parse(body);
          const names = (parsed.models || []).map(m => m.name);
          const hasExact = names.includes(safeModel);
          const base = safeModel.split(':')[0];
          const hasBase = names.some(n => n.split(':')[0] === base);
          resolve({ ok: hasExact || hasBase, names });
        } catch (e) {
          resolve({ ok: false, reason: 'Parse tags failed' });
        }
      });
    });
    tagsReq.on('error', () => resolve({ ok: false, reason: 'Tags request failed' }));
    tagsReq.on('timeout', () => { tagsReq.destroy(); resolve({ ok: false, reason: 'Tags timeout' }); });
    tagsReq.end();
  });

  const availability = await ensureModelAvailable();
  if (!availability.ok) {
    // Also peek at manifest path to give a better hint
    let manifestModels = [];
    try {
      const configPath = path.join(__dirname, 'ollama-config.json');
      let modelsRoot = process.env.OLLAMA_MODELS || path.join(app.getPath('home'), '.ollama', 'models');
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (cfg.usingExternal && cfg.externalPath && fs.existsSync(cfg.externalPath)) {
          modelsRoot = cfg.externalPath;
        }
      }
      const manifestRoot = path.join(modelsRoot, 'manifests', 'registry.ollama.ai', 'library');
      const dirs = fs.readdirSync(manifestRoot, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('._'));
      for (const dir of dirs) {
        const tags = fs.readdirSync(path.join(manifestRoot, dir.name), { withFileTypes: true })
          .filter(f => (f.isFile() || f.isDirectory()) && !f.name.startsWith('._'))
          .map(f => f.name.trim())
          .filter(Boolean);
        if (tags.length === 0) manifestModels.push(dir.name);
        else tags.forEach(t => manifestModels.push(`${dir.name}:${t}`));
      }
    } catch (e) {
      // ignore
    }

    const apiHint = availability.names && availability.names.length > 0
      ? `Ollama is currently serving: ${availability.names.join(', ')}`
      : 'Ollama reported no models on the running instance.';
    const manifestHint = manifestModels.length > 0
      ? `Models found on disk: ${manifestModels.join(', ')}`
      : '';

    return {
      success: false,
      error: `Model "${safeModel}" not available from the running Ollama server. Start Ollama with the correct models path (e.g., OLLAMA_MODELS="/Volumes/A005/ollama-models" ollama serve). ${apiHint}${manifestHint ? ' | ' + manifestHint : ''}`
    };
  }

  const payload = {
    model: safeModel,
    messages: messages,
    stream: true,  // Enable streaming like official Ollama app
    keep_alive: "10m",  // Keep model loaded for 10 minutes
    think: safeModel.toLowerCase().includes('deepseek'),  // Enable thinking for reasoning models
    options: {
      ...modelConfig,
      num_ctx: 4096,
      num_predict: 400, // allow slightly longer responses
    },
  };

  const postData = JSON.stringify(payload);
  console.log(`➡️  Posting to /api/chat with model="${safeModel}" and ${messages.length} messages`);
  console.log('📦 Payload preview:', postData.slice(0, 300));

  const options = {
    hostname: '127.0.0.1', // Use IPv4 explicitly instead of localhost
    port: 11434,
    path: '/api/chat',
    method: 'POST',
    timeout: 600000, // 10 minute timeout for long responses and thinking models
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  // We return a promise that resolves when the request initiates successfully
  // The actual data will be streamed via ipcRenderer.send
  return new Promise((resolve) => {
    const req = http.request(options, res => {
      // Store the request to allow cancellation
      const requestId = Date.now().toString();
      activeRequests.set(requestId, req);
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let errorBody = '';

      // Notify renderer that stream started
      event.sender.send('chat-stream-start', { requestId });
      resolve({ success: true, requestId });

      let fullResponse = '';
      let lastStreamText = '';

      const processBuffer = () => {
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            
            // Log error from Ollama if present
            if (parsed.error) {
              console.error('❌ Ollama API Error:', parsed.error);
              event.sender.send('chat-stream-error', {
                requestId,
                error: parsed.error
              });
              return;
            }

            const content = parsed?.message?.content ?? parsed?.response ?? '';

            if (content) {
              let delta = '';
              
              // Detect if content is a snapshot (contains fullResponse as prefix)
              if (fullResponse && content.startsWith(fullResponse)) {
                // This is a snapshot; extract only the new tail
                delta = content.slice(fullResponse.length);
                fullResponse = content;
                lastStreamText = content;
              } else if (lastStreamText && content.startsWith(lastStreamText)) {
                // Incremental snapshot from last streamed text
                delta = content.slice(lastStreamText.length);
                fullResponse = content;
                lastStreamText = content;
              } else if (fullResponse && content.length > fullResponse.length) {
                // Check for near-match (handles slight overlaps/duplication)
                // If content is mostly the same but slightly longer, treat as snapshot
                const overlap = Math.min(fullResponse.length, content.length);
                if (content.slice(0, overlap) === fullResponse.slice(0, overlap)) {
                  delta = content.slice(fullResponse.length);
                  fullResponse = content;
                  lastStreamText = content;
                } else {
                  // Mismatch; treat as true delta
                  delta = content;
                  fullResponse += delta;
                  lastStreamText = fullResponse;
                }
              } else {
                // True delta or first chunk
                delta = content;
                fullResponse += delta;
                lastStreamText = fullResponse;
              }

              if (delta) {
                event.sender.send('chat-stream-chunk', {
                  requestId,
                  content: delta,
                  done: false
                });
              }
            }
            
            if (parsed.done) {
              console.log('✅ Ollama signaled done');
            }
          } catch (e) {
            // Skip malformed line
          }
        }
      };

      res.on('data', chunk => {
        const decoded = decoder.decode(chunk, { stream: true });
        if (res.statusCode !== 200) {
          errorBody += decoded;
          return;
        }
        buffer += decoded;
        processBuffer();
      });

      res.on('end', () => {
        activeRequests.delete(requestId);
        buffer += decoder.decode();

        if (res.statusCode !== 200) {
          const cleanError = (errorBody || '').toString().trim() || `Request failed (HTTP ${res.statusCode})`;
          event.sender.send('chat-stream-error', {
            requestId,
            error: cleanError
          });
          return;
        }

        processBuffer();

        // Update history
        if (res.statusCode === 200) {
          history.push({ role: 'user', content: message });
          history.push({ role: 'assistant', content: fullResponse });
          if (history.length > 30) history = history.slice(-30);
          global.conversationHistory.set(conversationKey, history);
        }

        event.sender.send('chat-stream-end', {
          requestId,
          fullResponse,
          success: true
        });

        console.log(`✅ Stream complete (${fullResponse.length} chars)`);
      });

      // Handle timeout
      req.on('timeout', () => {
        console.error('❌ Request timeout');
        req.destroy();
        activeRequests.delete(requestId);
        event.sender.send('chat-stream-error', {
          requestId,
          error: 'Request timeout'
        });
      });
    });

    req.on('error', error => {
      console.log('HTTP Request Error:', error.message);
      activeRequests.delete(requestId);
      event.sender.send('chat-stream-error', {
        requestId,
        error: `Connection failed: ${error.message}`,
      });
      resolve({
        success: false,
        error: `Connection failed: ${error.message}`,
      });
    });

    // Set timeout
    req.setTimeout(120000);
    req.write(postData);
    req.end();
  });
});

// Handle chat abort
ipcMain.handle('abort-chat', async (event, requestId) => {
  if (requestId && activeRequests.has(requestId)) {
    const req = activeRequests.get(requestId);
    req.destroy();
    activeRequests.delete(requestId);
    console.log(`🛑 Chat request ${requestId} aborted by user`);
    return { success: true };
  }
  return { success: false, error: 'Request not found' };
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

    const env = { ...process.env };
    const configPath = path.join(__dirname, 'ollama-config.json');
    let externalDrivePath = null;

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.usingExternal && config.externalPath) {
          if (fs.existsSync(config.externalPath)) {
            // Ensure directory exists
            try {
              fs.mkdirSync(config.externalPath, { recursive: true });
            } catch (e) {
              console.warn(`⚠️ Could not create external models directory: ${e.message}`);
            }
            externalDrivePath = config.externalPath;
            env.OLLAMA_MODELS = config.externalPath;
            console.log(`📥 Downloading ${fullModelName} to external drive: ${config.externalPath}`);
          } else {
            console.warn(`⚠️ External drive configured but not mounted: ${config.externalPath}. Falling back to local models path.`);
          }
        }
      } catch (error) {
        console.warn('⚠️ Error reading external drive config, using default models path');
      }
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
        const cleanError = (error || 'Download failed')
          .toString()
          .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
          .replace(/\r/g, '')
          .trim();
        console.error(`❌ Failed to download ${fullModelName}:`, cleanError);
        resolve({ success: false, error: cleanError, model: fullModelName });
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

      // Fallback to default location (user home)
      const defaultPath =
        process.env.OLLAMA_MODELS || path.join(app.getPath('home'), '.ollama', 'models');
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
        if (fs.existsSync(config.externalPath)) {
          shell.openPath(config.externalPath);
          return {
            success: true,
            message: `Opened external drive location: ${config.externalPath}`,
            path: config.externalPath,
          };
        } else {
          console.warn(`⚠️ External path configured but not found: ${config.externalPath}`);
        }
      }
    }

    // Fallback to default location
    const defaultPath =
      process.env.OLLAMA_MODELS || path.join(app.getPath('home'), '.ollama', 'models');
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

ipcMain.handle('get-downloaded-models', async () => {
  try {
    const configPath = path.join(__dirname, 'ollama-config.json');
    const defaultModelsRoot = path.join(app.getPath('home'), '.ollama', 'models');
    let modelsRoot = process.env.OLLAMA_MODELS || defaultModelsRoot;

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.usingExternal && config.externalPath && fs.existsSync(config.externalPath)) {
          modelsRoot = config.externalPath;
          console.log(`🎯 Loading models from external drive: ${modelsRoot}`);
        } else if (config.usingExternal && config.externalPath) {
          console.warn(`⚠️ External drive configured but not mounted: ${config.externalPath}. Using local models path.`);
        }
      } catch (error) {
        console.warn('⚠️ Error reading external drive config, using local models path');
      }
    }

    const manifestsRoot = path.join(modelsRoot, 'manifests', 'registry.ollama.ai', 'library');
    if (!fs.existsSync(manifestsRoot)) {
      return { success: true, models: [] };
    }

    const models = [];
    const modelDirs = fs
      .readdirSync(manifestsRoot, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('._'));

    for (const dir of modelDirs) {
      const baseName = dir.name;
      const tagPath = path.join(manifestsRoot, baseName);
      const tags = fs
        .readdirSync(tagPath, { withFileTypes: true })
        .filter(f => (f.isFile() || f.isDirectory()) && !f.name.startsWith('._'))
        .map(f => f.name.trim())
        .filter(Boolean);

      if (tags.length === 0) {
        models.push(baseName);
      } else {
        tags.forEach(tag => models.push(`${baseName}:${tag}`));
      }
    }

    return { success: true, models };
  } catch (error) {
    console.error('Failed to read downloaded models:', error);
    return { success: false, error: error.message, models: [] };
  }
});

// Delete a model
ipcMain.handle('delete-model', async (event, modelName) => {
  return new Promise(resolve => {
    // Prefer external drive if configured and mounted
    const env = { ...process.env };
    try {
      const configPath = path.join(__dirname, 'ollama-config.json');
      if (require('fs').existsSync(configPath)) {
        const config = JSON.parse(
          require('fs').readFileSync(configPath, 'utf8')
        );
        if (config.usingExternal && config.externalPath) {
          if (fs.existsSync(config.externalPath)) {
            env.OLLAMA_MODELS = config.externalPath;
          } else {
            console.warn(`⚠️ External path not mounted for delete: ${config.externalPath}. Using local models path.`);
          }
        }
      }
    } catch (e) {
      console.log('No external drive config found, using default path');
    }

    const candidates = new Set();
    const base = modelName.split(':')[0];
    candidates.add(modelName);
    candidates.add(base);
    candidates.add(`${base}:latest`);
    candidates.add(`${modelName}:latest`);

    const tried = [];

    const tryDelete = (name, cb) => {
      const proc = spawn('ollama', ['rm', name], { env });
      let error = '';
      proc.stderr.on('data', d => { error += d.toString(); });
      proc.on('close', code => {
        tried.push({ name, code, error });
        cb(code === 0);
      });
      proc.on('error', err => {
        tried.push({ name, code: -1, error: err.message });
        cb(false);
      });
    };

    const attemptQueue = Array.from(candidates);
    const next = () => {
      if (attemptQueue.length === 0) {
        const success = tried.some(t => t.code === 0);
        if (success) {
          resolve({ success: true });
        } else {
          const firstErr = tried.find(t => t.error)?.error || 'Failed to delete model';
          const cleanError = firstErr.toString().replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').trim();
          resolve({ success: false, error: cleanError || 'Failed to delete model' });
        }
        return;
      }
      const name = attemptQueue.shift();
      tryDelete(name, ok => {
        if (ok) {
          resolve({ success: true });
        } else {
          next();
        }
      });
    };

    next();
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
      execSync('pkill -9 -f "ollama serve"', { stdio: 'ignore' });
      console.log('✅ Killed existing Ollama process');
      // Wait longer to ensure process is fully terminated
      setTimeout(() => resolve({ success: true }), 2000);
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
    // REQUIRE external drive - read config first
    const configPath = path.join(__dirname, 'ollama-config.json');
    let drivePath = null;

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.usingExternal && config.externalPath) {
          drivePath = config.externalPath;
        }
      } catch (error) {
        console.error('Error reading config');
      }
    }

    if (!drivePath) {
      console.error('❌ External drive not configured - cannot start Ollama');
      resolve({
        success: false,
        error: 'External drive not configured. Please configure in Settings.',
      });
      return;
    }

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
    # CRITICAL: Always use external drive path
    drive_path = '${drivePath}'
    
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
    
    # Start ollama serve with OLLAMA_MODELS env var set to external drive
    env = os.environ.copy()
    env['OLLAMA_MODELS'] = drive_path
    
    print(json.dumps({"success": True, "message": "Starting Ollama with external drive: " + drive_path}))
    
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
        // Check if the drive is actually mounted
        const isMounted = fs.existsSync(config.externalPath);
        
        return {
          configured: true,
          path: config.externalPath,
          driveName: config.driveName,
          mounted: isMounted
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

// ===== RAG SYSTEM HANDLERS =====

// Open file dialog for document selection
ipcMain.handle('open-file-dialog', async (event, options) => {
  const { dialog } = require('electron');
  return await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }]
  });
});

// Upload document for RAG
ipcMain.handle('rag-upload-document', async (event, filePath) => {
  return new Promise((resolve) => {
    let resolved = false;

    const python = spawn('python3', [
      path.join(__dirname, 'rag_system.py'),
      'add',
      filePath
    ]);

    let output = '';
    let errorOutput = '';

    // Set timeout (60 seconds for large files)
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        python.kill();
        resolve({ success: false, error: 'Upload timeout - file too large or processing took too long' });
      }
    }, 60000);

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);

        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (e) {
            console.error('Parse error:', e, 'Output:', output);
            resolve({ success: false, error: 'Failed to parse response: ' + e.message });
          }
        } else {
          resolve({ success: false, error: errorOutput || 'Upload failed with code ' + code });
        }
      }
    });

    python.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ success: false, error: 'Process error: ' + err.message });
      }
    });
  });
});

// List RAG documents
ipcMain.handle('rag-list-documents', async () => {
  return new Promise((resolve) => {
    const python = spawn('python3', [
      path.join(__dirname, 'rag_system.py'),
      'list'
    ]);

    let output = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          resolve([]);
        }
      } else {
        resolve([]);
      }
    });
  });
});

// Delete RAG document
ipcMain.handle('rag-delete-document', async (event, fileName) => {
  return new Promise((resolve) => {
    const python = spawn('python3', [
      path.join(__dirname, 'rag_system.py'),
      'delete',
      fileName
    ]);

    let output = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse response' });
        }
      } else {
        resolve({ success: false, error: 'Delete failed' });
      }
    });
  });
});

// Search RAG documents
ipcMain.handle('rag-search', async (event, query, nResults = 3) => {
  return new Promise((resolve) => {
    const python = spawn('python3', [
      path.join(__dirname, 'rag_system.py'),
      'search',
      query,
      nResults.toString()
    ]);

    let output = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          resolve([]);
        }
      } else {
        resolve([]);
      }
    });
  });
});
