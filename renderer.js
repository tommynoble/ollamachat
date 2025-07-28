const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const modelSelect = document.getElementById('model-select');
const refreshModelsBtn = document.getElementById('refresh-models');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const refreshDrivesBtn = document.getElementById('refresh-drives');
const drivesList = document.getElementById('drives-list');
const autoRefreshIndicator = document.getElementById('auto-refresh-indicator');
const modelsGrid = document.getElementById('models-grid');

// Global variables
let autoRefreshInterval = null;
let activeDrive = null;
const downloadingModels = new Set();

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkOllamaStatus();
    setupEventListeners();
});

function setupEventListeners() {
    // Chat functionality
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Model management
    refreshModelsBtn.addEventListener('click', loadAvailableModels);
    
    // Settings modal
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    refreshDrivesBtn.addEventListener('click', refreshDrives);
}

// Check Ollama status
async function checkOllamaStatus() {
    try {
        const status = await ipcRenderer.invoke('check-ollama-status');
        
        if (status.installed && status.running) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Online';
        } else if (status.installed && !status.running) {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Ollama not running';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Ollama not installed';
        }
    } catch (error) {
        console.error('Status check failed:', error);
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Error checking status';
    }
}

// Load available models
async function loadModels() {
    try {
        const result = await ipcRenderer.invoke('get-models');
        
        if (result.success && result.models.length > 0) {
            modelSelect.innerHTML = '';
            result.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
            
            // Select first model by default
            currentModel = result.models[0];
            modelSelect.value = currentModel;
        } else {
            modelSelect.innerHTML = '<option value="">No models available</option>';
        }
    } catch (error) {
        console.error('Failed to load models:', error);
        modelSelect.innerHTML = '<option value="">Error loading models</option>';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Send button click
    sendButton.addEventListener('click', sendMessage);
    
    // Enter key in textarea (but allow Shift+Enter for new line)
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Auto-resize textarea
    messageInput.addEventListener('input', autoResizeTextarea);
    
    // Enable/disable send button based on input
    messageInput.addEventListener('input', updateSendButton);
    
    // Model selection change
    modelSelect.addEventListener('change', (e) => {
        currentModel = e.target.value;
    });
    
    // Refresh models button
    refreshModelsBtn.addEventListener('click', async () => {
        refreshModelsBtn.style.transform = 'rotate(180deg)';
        await loadModels();
        await checkOllamaStatus();
        setTimeout(() => {
            refreshModelsBtn.style.transform = 'rotate(0deg)';
        }, 300);
    });
    
    // Quick suggestion buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-btn')) {
            const message = e.target.getAttribute('data-message');
            messageInput.value = message;
            updateSendButton();
            messageInput.focus();
        }
    });

    // Settings modal
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    refreshDrivesBtn.addEventListener('click', refreshDrives);
    
    // Model browser functionality
    refreshModelsBtn.addEventListener('click', loadAvailableModels);
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const message = btn.getAttribute('data-message');
            messageInput.value = message;
            sendMessage();
        });
    });

    // Listen for download progress
    ipcRenderer.on('download-progress', (event, data) => {
        updateDownloadProgress(data);
    });
}

// Auto-resize textarea
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

// Update send button state
function updateSendButton() {
    const hasText = messageInput.value.trim().length > 0;
    sendButton.disabled = !hasText || isLoading;
}

// Chat Functions
async function sendMessage() {
    const message = messageInput.value.trim();
    const selectedModel = modelSelect.value;
    
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    messageInput.value = '';
    
    // Check for model switching commands
    const modelSwitchPattern = /(?:use|switch to|load)\s+(\w+)/i;
    const match = message.match(modelSwitchPattern);
    
    if (match) {
        const requestedModel = match[1].toLowerCase();
        const availableModels = Array.from(modelSelect.options).map(opt => opt.value);
        
        // Find closest match
        const modelMatch = availableModels.find(model => 
            model.toLowerCase().includes(requestedModel) || 
            requestedModel.includes(model.toLowerCase())
        );
        
        if (modelMatch) {
            modelSelect.value = modelMatch;
            addMessage(`Switched to ${modelMatch}`, 'system');
            return;
        }
    }
    
    try {
        // Show typing indicator
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('message', 'assistant', 'typing');
        typingDiv.innerHTML = '<div class="message-content">🤔 Thinking...</div>';
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Send message to backend
        const response = await ipcRenderer.invoke('chat-message', message, selectedModel);
        
        // Remove typing indicator
        typingDiv.remove();
        
        if (response.success) {
            addMessage(response.message, 'assistant');
        } else {
            addMessage('Error: ' + response.error, 'assistant');
        }
    } catch (error) {
        // Remove typing indicator
        const typingIndicator = document.querySelector('.typing');
        if (typingIndicator) typingIndicator.remove();
        
        addMessage('Error: ' + error.message, 'assistant');
    }
}

// Add system message support
function addMessage(content, sender = 'user') {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    
    if (sender === 'system') {
        messageDiv.innerHTML = `
            <div class="message-content system-message">
                <span class="system-icon">ℹ️</span>
                ${content}
            </div>
        `;
    } else {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender">${sender === 'user' ? 'You' : 'Assistant'}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${content}</div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Basic message formatting
function formatMessage(content) {
    // Escape HTML first
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    let formatted = escapeHtml(content);
    
    // Simple code block formatting (```code```)
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code formatting (`code`)
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold formatting (**text**)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

// Set loading state
function setLoading(loading) {
    isLoading = loading;
    
    if (loading) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
    
    updateSendButton();
}

// Settings Modal Functions
let driveRefreshInterval = null;

async function openSettings() {
    settingsModal.style.display = 'flex';
    
    // Load available models for download
    loadAvailableModels();
    
    // Refresh drives list
    refreshDrives();
    
    // Start auto-refresh for drives
    autoRefreshInterval = setInterval(refreshDrives, 3000);
    
    // Show auto-refresh indicator
    autoRefreshIndicator.style.display = 'inline';
}

function closeSettings() {
    settingsModal.style.display = 'none';
    
    // Clear auto-refresh interval
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
    
    // Hide auto-refresh indicator
    autoRefreshIndicator.style.display = 'none';
}

async function refreshDrives() {
    // Only show scanning message if drives list is empty
    if (drivesList.children.length === 0 || drivesList.innerHTML.includes('scanning-drives')) {
        drivesList.innerHTML = '<div class="scanning-drives">Scanning for drives...</div>';
    }
    
    try {
        const result = await ipcRenderer.invoke('detect-external-drives');
        
        if (result.success) {
            displayDrives(result.drives);
        } else {
            drivesList.innerHTML = `<div class="scanning-drives">Error: ${result.error}</div>`;
        }
    } catch (error) {
        console.error('Drive detection failed:', error);
        drivesList.innerHTML = '<div class="scanning-drives">Failed to detect drives</div>';
    }
}

function displayDrives(drives) {
    if (drives.length === 0) {
        drivesList.innerHTML = '<div class="scanning-drives">No external drives found</div>';
        return;
    }
    
    drivesList.innerHTML = drives.map(drive => `
        <div class="drive-item">
            <div class="drive-info">
                <div class="drive-icon">💾</div>
                <div class="drive-details">
                    <h4>${drive.name}</h4>
                    <p>${drive.path}</p>
                </div>
            </div>
            <div class="drive-actions">
                <button class="use-drive-btn ${activeDrive === drive.name ? 'active' : ''}" 
                        onclick="useDrive('${drive.name}', '${drive.path}', this)"
                        ${activeDrive === drive.name ? 'disabled' : ''}>
                    ${activeDrive === drive.name ? 'Currently Used ✓' : 'Use for Models'}
                </button>
                <button class="eject-btn" onclick="showEjectOptions('${drive.name}')">
                    ⏏️ Eject
                </button>
            </div>
        </div>
    `).join('');
}

function showEjectOptions(driveName) {
    const choice = confirm(`Choose eject method for "${driveName}":
    
OK = Normal Eject (safer)
Cancel = Force Eject (if normal fails)`);
    
    if (choice) {
        ejectDrive(driveName, false); // Normal eject
    } else {
        ejectDrive(driveName, true);  // Force eject
    }
}

async function ejectDrive(driveName, force = false) {
    const ejectType = force ? "force eject" : "eject";
    
    try {
        const result = await ipcRenderer.invoke('eject-drive', driveName, force);
        
        if (result.success) {
            alert(`Drive "${driveName}" ejected successfully`);
            refreshDrives(); // Refresh the list
        } else {
            const errorMsg = result.error || 'Unknown error';
            if (!force && errorMsg.includes('could not be unmounted')) {
                // Offer force eject as alternative
                if (confirm(`Normal eject failed because something is using the drive. Try force eject?\n\nError: ${errorMsg}`)) {
                    ejectDrive(driveName, true);
                }
            } else {
                alert(`Failed to ${ejectType} drive: ${errorMsg}`);
            }
        }
    } catch (error) {
        console.error('Eject failed - full error object:', error);
        console.error('Error type:', typeof error);
        console.error('Error keys:', Object.keys(error));
        
        let errorMsg = 'Unknown error';
        
        // Try different ways to extract the error message
        if (typeof error === 'string') {
            errorMsg = error;
        } else if (error && error.error) {
            errorMsg = error.error;
        } else if (error && error.message) {
            errorMsg = error.message;
        } else if (error && error.toString) {
            errorMsg = error.toString();
        } else {
            errorMsg = JSON.stringify(error);
        }
        
        if (!force && errorMsg.includes('could not be unmounted')) {
            if (confirm(`Normal eject failed. Try force eject?\n\nError: ${errorMsg}`)) {
                ejectDrive(driveName, true);
            }
        } else {
            alert(`Failed to ${ejectType} drive: ${errorMsg}`);
        }
    }
}

function useDrive(driveName, drivePath, buttonElement) {
    // Show confirmation dialog with details
    const confirmMessage = `Use external drive "${driveName}" for all model storage?

📍 Drive Location: ${drivePath}
📁 Models Folder: ${drivePath}/ollama-models/

ℹ️  What will happen:
• All new model downloads will go to external drive
• Your existing local models will be moved to external drive
• Local computer storage will stay lightweight
• You'll need to manually restart Ollama after this change

⚠️  Note: This app requires external storage to prevent local storage bloat.

Do you want to continue?`;

    if (!confirm(confirmMessage)) {
        return; // User cancelled
    }

    // Show loading state
    const button = buttonElement;
    const originalText = button.textContent;
    button.textContent = 'Setting up...';
    button.disabled = true;

    // Call the backend to set up external drive
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('use-for-models', driveName, drivePath)
        .then(result => {
            if (result.success) {
                // Show success message with restart instruction
                alert(`✅ Success! External drive "${driveName}" is now configured for Ollama models.

📁 Models will be stored at:
${result.modelsPath}

⚠️  IMPORTANT: Please restart Ollama manually for this change to take effect.

Your existing models remain at:
${result.originalPath}`);

                // Store which drive is active
                activeDrive = driveName;
                
                // Update button state
                button.textContent = 'Currently Used ✓';
                button.classList.add('active');
                button.disabled = true;

                // Don't refresh drives list to avoid overwriting our button state
            } else {
                // Show error message
                alert(`❌ Failed to setup external drive: ${result.error}`);
                
                // Restore button state
                button.textContent = originalText;
                button.disabled = false;
            }
        })
        .catch(error => {
            alert(`❌ Error: ${error.message || error}`);
            
            // Restore button state
            button.textContent = originalText;
            button.disabled = false;
        });
}

// Model Browser Functions
function loadAvailableModels() {
    // Hardcoded popular models for instant display
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
    
    // Display models instantly
    displayAvailableModels(models);
}

function createModelCard(model, variant) {
    const card = document.createElement('div');
    card.className = 'model-card';
    
    const fullName = `${model.name}:${variant}`;
    const isDownloading = downloadingModels.has(fullName);
    
    // Create all content in one operation to avoid reflows
    card.innerHTML = `
        <div class="model-header">
            <div class="model-name">${model.name}:${variant}</div>
            <div class="model-size">${model.sizes[variant]}</div>
        </div>
        <div class="model-description">${model.description}</div>
        <div class="model-meta">
            <div class="model-tags">
                ${model.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <div class="download-time">⏱️ ${model.downloadTime[variant]}</div>
        </div>
        <button class="download-model-btn" onclick="downloadModel('${model.name}', '${variant}')" 
                ${isDownloading ? 'disabled' : ''}>
            ${isDownloading ? 'Downloading...' : 'Download Model'}
        </button>
    `;
    
    return card;
}

function displayAvailableModels(models) {
    // Create a document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    models.forEach(model => {
        model.variants.forEach(variant => {
            const modelCard = createModelCard(model, variant);
            fragment.appendChild(modelCard);
        });
    });
    
    // Clear and append all at once to avoid multiple reflows
    modelsGrid.innerHTML = '';
    modelsGrid.appendChild(fragment);
}

async function downloadModel(modelName, variant) {
    const fullName = `${modelName}:${variant}`;
    
    // Check if external drive is configured
    try {
        // For now, let's skip the external drive check and allow direct downloads
        console.log(`Starting download of ${fullName}`);
    } catch (error) {
        console.log('External drive check skipped, proceeding with download');
    }
    
    // Find the button that was clicked
    const buttons = document.querySelectorAll('.download-model-btn');
    let buttonElement = null;
    
    for (const btn of buttons) {
        const onClick = btn.getAttribute('onclick');
        if (onClick && onClick.includes(`'${modelName}'`) && onClick.includes(`'${variant}'`)) {
            buttonElement = btn;
            break;
        }
    }
    
    if (!buttonElement) {
        console.error('Could not find download button');
        return;
    }
    
    // Update UI
    downloadingModels.add(fullName);
    buttonElement.textContent = 'Downloading...';
    buttonElement.disabled = true;
    buttonElement.style.background = '#6c757d';
    
    try {
        const result = await require('electron').ipcRenderer.invoke('download-model', modelName, variant);
        
        if (result.success) {
            buttonElement.textContent = 'Downloaded ✓';
            buttonElement.style.background = '#28a745';
            
            // Show success message
            addMessage(`Successfully downloaded ${fullName}! You can now select it from the model dropdown.`, 'system');
            
            // Refresh model selector to include new model
            await loadDownloadedModels();
            
            setTimeout(() => {
                buttonElement.textContent = 'Download Model';
                buttonElement.disabled = false;
                buttonElement.style.background = '#007bff';
                downloadingModels.delete(fullName);
            }, 3000);
        } else {
            buttonElement.textContent = 'Download Failed';
            buttonElement.style.background = '#dc3545';
            
            // Show error message
            addMessage(`Failed to download ${fullName}: ${result.error}`, 'system');
            
            setTimeout(() => {
                buttonElement.textContent = 'Download Model';
                buttonElement.disabled = false;
                buttonElement.style.background = '#007bff';
                downloadingModels.delete(fullName);
            }, 3000);
        }
    } catch (error) {
        console.error('Download error:', error);
        buttonElement.textContent = 'Download Failed';
        buttonElement.style.background = '#dc3545';
        
        addMessage(`Download error for ${fullName}: ${error.message}`, 'system');
        
        setTimeout(() => {
            buttonElement.textContent = 'Download Model';
            buttonElement.disabled = false;
            buttonElement.style.background = '#007bff';
            downloadingModels.delete(fullName);
        }, 3000);
    }
}

function updateDownloadProgress(data) {
    const modelCards = modelsGrid.querySelectorAll('.model-card');
    
    modelCards.forEach(card => {
        const downloadBtn = card.querySelector('.download-btn');
        if (downloadBtn && downloadBtn.textContent.includes('Downloading')) {
            const modelName = card.querySelector('.model-name').textContent;
            if (modelName === data.model) {
                const progressBar = card.querySelector('.download-progress-bar');
                if (progressBar && data.message) {
                    // Simple progress indication (could be enhanced with actual percentage)
                    downloadBtn.textContent = 'Downloading... ' + data.message.substring(0, 20) + '...';
                }
            }
        }
    });
}

async function loadDownloadedModels() {
    try {
        const result = await require('electron').ipcRenderer.invoke('get-downloaded-models');
        
        if (result.success && result.models) {
            // Update model selector
            const currentValue = modelSelect.value;
            modelSelect.innerHTML = '<option value="">Select a model...</option>';
            
            result.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = `${model.name} (${model.size})`;
                modelSelect.appendChild(option);
            });
            
            // Restore previous selection if still available
            if (currentValue && Array.from(modelSelect.options).some(opt => opt.value === currentValue)) {
                modelSelect.value = currentValue;
            }
        }
    } catch (error) {
        console.error('Failed to load downloaded models:', error);
    }
}

function displayDownloadedModels(models) {
    if (models.length === 0) {
        downloadedModelsList.innerHTML = '<div class="no-models">No models downloaded yet</div>';
        return;
    }
    
    downloadedModelsList.innerHTML = '';
    
    models.forEach(model => {
        const modelElement = document.createElement('div');
        modelElement.className = 'downloaded-model';
        
        modelElement.innerHTML = `
            <div class="downloaded-model-info">
                <div class="downloaded-model-name">${model.name}</div>
                <div class="downloaded-model-size">${model.size}</div>
            </div>
            <div class="downloaded-model-actions">
                <button class="use-model-btn" onclick="useModel('${model.name}')">Use in Chat</button>
                <button class="delete-model-btn" onclick="deleteModel('${model.name}')">Delete</button>
            </div>
        `;
        
        downloadedModelsList.appendChild(modelElement);
    });
}

async function useModel(modelName) {
    // Set the model in the chat selector
    const modelOption = Array.from(modelSelect.options).find(option => option.value === modelName);
    if (modelOption) {
        modelSelect.value = modelName;
        closeSettings();
        
        // Add a system message to indicate model switch
        addMessage(`Switched to ${modelName}`, 'system');
    } else {
        // Add model to selector if not present
        const option = document.createElement('option');
        option.value = modelName;
        option.textContent = modelName;
        modelSelect.appendChild(option);
        modelSelect.value = modelName;
        closeSettings();
        
        addMessage(`Switched to ${modelName}`, 'system');
    }
}

async function deleteModel(modelName) {
    if (confirm(`Are you sure you want to delete ${modelName}? This will free up space on your external drive.`)) {
        try {
            const result = await ipcRenderer.invoke('delete-model', modelName);
            
            if (result.success) {
                await loadDownloadedModels();
                await loadModels(); // Refresh model selector
                addMessage(`Deleted model ${modelName}`, 'system');
            } else {
                alert('Failed to delete model: ' + result.error);
            }
        } catch (error) {
            alert('Error deleting model: ' + error.message);
        }
    }
}

// Periodic status check
setInterval(checkOllamaStatus, 30000); // Check every 30 seconds

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize); 