const { ipcRenderer } = require('electron');

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const modelSelect = document.getElementById('model-select');
const refreshButton = document.getElementById('refresh-models');
const loadingOverlay = document.getElementById('loading-overlay');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const refreshDrivesBtn = document.getElementById('refresh-drives');
const drivesList = document.getElementById('drives-list');
const autoRefreshIndicator = document.getElementById('auto-refresh-indicator');

// State
let isLoading = false;
let autoRefreshInterval = null;
let activeDrive = null; // Store which drive is currently used for models
let currentModel = '';

// Initialize the app
async function initialize() {
    console.log('Initializing Ollama Chat...');
    
    // Check Ollama status
    await checkStatus();
    
    // Load available models
    await loadModels();
    
    // Set up event listeners
    setupEventListeners();
    
    // Focus on input
    messageInput.focus();
}

// Check Ollama status
async function checkStatus() {
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
    refreshButton.addEventListener('click', async () => {
        refreshButton.style.transform = 'rotate(180deg)';
        await loadModels();
        await checkStatus();
        setTimeout(() => {
            refreshButton.style.transform = 'rotate(0deg)';
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

    // Settings modal events
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    refreshDrivesBtn.addEventListener('click', refreshDrives);
    
    // Close modal when clicking outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettings();
        }
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

// Send message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isLoading) return;
    
    // Clear input and reset height
    messageInput.value = '';
    messageInput.style.height = 'auto';
    updateSendButton();
    
    // Hide welcome message if it exists
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }
    
    // Add user message to chat
    addMessage('user', message);
    
    // Show loading state
    setLoading(true);
    
    try {
        // Send message to backend
        const result = await ipcRenderer.invoke('send-message', message);
        
        if (result.success) {
            // Add AI response to chat
            addMessage('assistant', result.response);
        } else {
            // Add error message
            addMessage('assistant', `❌ Error: ${result.error}`);
        }
    } catch (error) {
        console.error('Send message failed:', error);
        addMessage('assistant', `❌ Failed to send message: ${error.message}`);
    } finally {
        setLoading(false);
        messageInput.focus();
    }
}

// Add message to chat
function addMessage(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Format content (basic markdown-like formatting)
    contentDiv.innerHTML = formatMessage(content);
    
    bubbleDiv.appendChild(contentDiv);
    messageDiv.appendChild(bubbleDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
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

function openSettings() {
    settingsModal.classList.remove('hidden');
    refreshDrives();
    
    // Auto-refresh drives every 3 seconds while settings is open
    driveRefreshInterval = setInterval(() => {
        refreshDrives();
    }, 3000);
    
    // Show auto-refresh indicator
    autoRefreshIndicator.classList.remove('hidden');
}

function closeSettings() {
    settingsModal.classList.add('hidden');
    
    // Stop auto-refresh when settings is closed
    if (driveRefreshInterval) {
        clearInterval(driveRefreshInterval);
        driveRefreshInterval = null;
    }
    
    // Hide auto-refresh indicator
    autoRefreshIndicator.classList.add('hidden');
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

// Periodic status check
setInterval(checkStatus, 30000); // Check every 30 seconds

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize); 