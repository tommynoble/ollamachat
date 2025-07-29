# PROJECT RULES

## 🤖 AI ASSISTANT RULES

**CRITICAL: Any AI model working on this project MUST follow these rules:**

1. **Always ask before making changes** - Suggest first, implement only after user approval
2. **Research thoroughly** - Analyze existing code structure before proposing solutions  
3. **Document everything** - Keep detailed notes of all modifications in this file
4. **Reference this file** - Read this file completely before starting any work
5. **Update this file** - Add any new changes to the MODIFICATION LOG section

## 📁 PROJECT OVERVIEW

- **Type**: Ollama Chat Application (Electron + Python hybrid)
- **Description**: Desktop chat application for Ollama AI models with beautiful UI
- **Tech Stack**: Electron (main), Python (backend), HTML/CSS/JS (frontend)
- **Key Features**: Glassmorphism UI, gradient buttons, model management, external drive support

## 🏗️ PROJECT STRUCTURE

### Core Files:
- `main.js` (1155 lines) - Electron main process, IPC handlers
- `renderer.js` (1888 lines) - Frontend logic, UI interactions
- `style.css` (2464 lines) - Beautiful styling with glassmorphism effects
- `index.html` (335 lines) - Main UI structure
- `ollama_chat.py` (418 lines) - Python backend for Ollama integration

### Configuration:
- `package.json` - Electron app configuration and dependencies
- `ollama-config.json` - Ollama settings
- `chat_config.json` - Chat configuration
- `env.example` - Environment variables template

### Documentation:
- `README.md` - Project documentation
- `EXTERNAL_DRIVE_PROGRESS.md` - External drive feature documentation
- `PRODUCTION_SETUP.md` - Production deployment guide
- `PROJECT_RULES.md` (this file) - AI assistant rules and modification log

## 🎨 CURRENT UI FEATURES

### Implemented Styling:
- **Glassmorphism design** with backdrop blur effects
- **Gradient buttons** with purple theme (#6366f1 to #8b5cf6)
- **Beautiful message bubbles** with hover animations
- **Custom notifications** with slide-in animations
- **Enhanced chat container** with glass effects
- **Smooth scrollbars** with gradient styling
- **Animated welcome screen** with bouncing icons

### Color Scheme:
- Primary gradient: `linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)`
- Hover gradient: `linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)`
- Glass background: `rgba(255, 255, 255, 0.9)` with backdrop-blur

## 🔧 TECHNICAL ARCHITECTURE

### IPC Communication:
- `get-models` - Retrieves available Ollama models
- `check-ollama-status` - Checks if Ollama server is running
- `start-ollama` - Attempts to start Ollama server
- `send-message` - Sends chat messages to models

### Error Handling:
- Smart Ollama status detection
- Retry mechanisms for model loading
- User-friendly error notifications
- Automatic status monitoring (10-second intervals)

## 📝 MODIFICATION LOG

### Session: July 29, 2025

#### 1. Enhanced Button Gradients
**Problem**: Bright gradient buttons were too intense
**Solution**: Updated suggestion buttons to softer gradients
**Files Modified**: `style.css`
**Changes**:
- Changed from `#4f46e5 0%, #7c3aed 100%` to `#6366f1 0%, #8b5cf6 100%`
- Reduced box-shadow opacity from 0.2 to 0.15
- Updated hover states to match new color scheme

#### 2. Beautified Chat Area
**Problem**: Basic chat interface needed visual enhancement
**Solution**: Implemented glassmorphism design system
**Files Modified**: `style.css`
**Major Changes**:
- Added glass effects to chat container with `backdrop-filter: blur(10px)`
- Enhanced message bubbles with hover animations and better shadows
- Improved welcome message with gradient text and animations
- Custom scrollbar with gradient styling
- Smooth slide-in animations for messages

#### 3. Fixed Model Loading Error
**Problem**: "Error loading models" due to Ollama not running
**Solution**: Comprehensive error handling and auto-start functionality
**Files Modified**: `renderer.js`, `main.js`, `style.css`
**Changes**:
- Added duplicate IPC handler detection and removal
- Implemented retry mechanism for model loading
- Created beautiful notification system
- Added Ollama status monitoring
- Added "Start Ollama" functionality in UI

#### 4. Enhanced Error Handling
**Problem**: Generic error messages weren't helpful
**Solution**: Smart error detection with specific user guidance
**Files Modified**: `renderer.js`
**Changes**:
- Added `showNotification()` function with beautiful UI
- Implemented specific error message detection
- Added retry logic with user feedback
- Created status-based UI states

## 🎯 PENDING FEATURES

#### 5. Enhanced Status System
**Problem**: Status showed "Ollama Running" immediately, even when models were still loading
**Solution**: Implemented granular status states with model readiness detection
**Files Modified**: `renderer.js`, `main.js`, `style.css`
**Changes**:
- Added 4 status states: Offline (🔴), Starting (🟡), Loading Model (🟠), Ready for Chat (🟢)
- Implemented model readiness check via test chat API call
- Added animated status indicators with pulsing effects
- Enhanced user feedback with specific notifications

### Typewriter Effect (Requested)
**Goal**: Implement ChatGPT-style character-by-character typing for responses
**Research Needed**:
- Locate current message rendering logic in `renderer.js`
- Understand how assistant responses are displayed
- Design smooth typing animation system
- Maintain existing beautiful styling during typing

**Current Status**: Pending - Enhanced status system completed first

## 💡 DEVELOPMENT GUIDELINES

### Before Making Changes:
1. **Read this file completely**
2. **Ask user for permission** before implementing
3. **Research existing code** thoroughly
4. **Propose specific solution** with code examples
5. **Update this log** after implementation

### Code Style:
- Use existing color scheme and gradients
- Maintain glassmorphism design consistency
- Follow current animation patterns
- Preserve responsive design
- Keep accessibility in mind

### Testing:
- Verify Ollama integration works
- Test error scenarios
- Check UI responsiveness
- Validate notification system

## 🔄 HOW TO USE THIS FILE

### For Users:
Tell any new AI model: **"First read PROJECT_RULES.md to understand our project and how to work with me"**

### For AI Models:
1. Read this entire file before starting
2. Follow the rules strictly
3. Reference the modification log for context
4. Update this file with any new changes
5. Always ask before modifying anything

---

**Last Updated**: July 29, 2025  
**Total Lines of Code**: ~6,000+  
**Current Status**: Stable, ready for typewriter effect implementation 