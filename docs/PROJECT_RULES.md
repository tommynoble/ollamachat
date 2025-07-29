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

## 🚀 PRODUCTION READINESS CHECKLIST

### Code Quality & Performance:

#### **CRITICAL - Must Check Every Time:**
1. **ESLint Errors**: Run `npm run lint` - Zero errors allowed in production
2. **Console Logs**: Remove or minimize console.log statements for production
3. **Error Handling**: All async operations must have proper try-catch blocks
4. **Memory Leaks**: Check for uncleaned intervals, event listeners, timeouts
5. **File Size**: Monitor bundle size - keep under reasonable limits

#### **Development Tools Integration:**
1. **Run code formatting**: `npm run format` before every commit
2. **Fix linting issues**: `npm run lint` should show minimal warnings
3. **Test hot reload**: Ensure `npm run dev` works without errors
4. **Electron restart**: Verify `npm run dev:electron` auto-restarts properly

#### **Performance Monitoring:**
1. **Startup Time**: App should start in < 3 seconds
2. **Memory Usage**: Monitor for memory leaks during extended use
3. **Chat Response Time**: UI should remain responsive during model processing
4. **File Loading**: Large conversations should load progressively

### Security & Privacy:

#### **Data Protection:**
1. **Local Storage**: Ensure all data stays on user's machine
2. **API Keys**: No hardcoded keys or sensitive data in code
3. **File Permissions**: Check file access permissions are minimal
4. **Network Requests**: Only to localhost (Ollama API)

#### **Input Validation:**
1. **User Input**: Sanitize all user inputs before processing
2. **File Paths**: Validate file paths to prevent directory traversal
3. **Model Names**: Validate model names from Ollama API
4. **Configuration**: Validate all config files and settings

### UI/UX Standards:

#### **Cross-Platform Compatibility:**
1. **Window Sizing**: Test on different screen resolutions
2. **Font Rendering**: Ensure fonts load properly on all platforms
3. **File Paths**: Use path.join() for cross-platform file handling
4. **Keyboard Shortcuts**: Test platform-specific shortcuts

#### **Accessibility:**
1. **Keyboard Navigation**: All features accessible via keyboard
2. **Screen Readers**: Proper ARIA labels and semantic HTML
3. **Color Contrast**: Maintain contrast ratios for readability
4. **Motion Sensitivity**: Respect prefers-reduced-motion settings

### Error Handling & Recovery:

#### **Ollama Integration:**
1. **Connection Failures**: Graceful handling when Ollama is offline
2. **Model Loading**: Clear feedback during model loading/switching
3. **API Timeouts**: Handle long response times gracefully
4. **Model Errors**: User-friendly error messages for model failures

#### **Application Recovery:**
1. **Crash Prevention**: Wrap critical functions in try-catch
2. **State Recovery**: Save/restore application state on restart
3. **Data Backup**: Automatic backup of important conversations
4. **Corruption Handling**: Handle corrupted config files gracefully

### Build & Deployment:

#### **Pre-Production Checklist:**
1. **Build Process**: `npm run build` completes without errors
2. **Production Testing**: Test built version thoroughly
3. **File Size Optimization**: Minimize unnecessary assets
4. **Version Management**: Proper version numbering in package.json

#### **Distribution Readiness:**
1. **Electron Builder**: Configure for target platforms
2. **Code Signing**: Set up code signing certificates
3. **Auto-Updates**: Implement secure update mechanism
4. **Documentation**: Complete user documentation

### Monitoring & Maintenance:

#### **Logging Strategy:**
1. **Error Logging**: Comprehensive error logging system
2. **Performance Metrics**: Track key performance indicators
3. **User Analytics**: Privacy-respecting usage analytics
4. **Debug Information**: Helpful debug info for troubleshooting

#### **Update Management:**
1. **Backward Compatibility**: Maintain config file compatibility
2. **Migration Scripts**: Data migration for breaking changes
3. **Rollback Plan**: Ability to rollback problematic updates
4. **User Communication**: Clear changelog and update notes

### **AI Model Implementation Rules:**

#### **Before Any Code Changes:**
1. Run `npm run lint` and fix all errors
2. Check for duplicate functions (common issue found in this project)
3. Verify no hardcoded values that should be configurable
4. Ensure proper error handling for all new features

#### **After Implementation:**
1. Run full test suite: `npm run format && npm run lint`
2. Test feature with Ollama offline to ensure graceful degradation
3. Check for memory leaks during extended use
4. Update DEVELOPMENT.md if adding new development workflows

#### **Code Review Checklist:**
1. **Functions**: No duplicate function declarations
2. **Variables**: Remove unused variables (ESLint warnings)
3. **Dependencies**: Only add necessary dependencies
4. **Comments**: Update comments for complex logic
5. **TODOs**: Convert TODO comments to actual implementations

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

## 🤖 AUTOMATED PRODUCTION CHECKS

### **Pre-Commit Hooks (Recommended for Future):**
```bash
# Add these to package.json scripts for automated checking
"pre-commit": "npm run format && npm run lint && npm run test-critical",
"test-critical": "npm run test:ollama && npm run test:ui && npm run test:memory",
"production-check": "npm run lint && npm run build && npm run test:production"
```

### **CI/CD Pipeline Checks:**
1. **Code Quality Gate**: ESLint errors = 0, warnings < 50
2. **Security Scan**: No hardcoded secrets or API keys
3. **Performance Test**: Startup time < 3 seconds
4. **Cross-Platform Build**: Test on Windows, macOS, Linux
5. **Memory Leak Detection**: Extended runtime testing

### **Release Readiness Automation:**
```javascript
// Example automated check script (to be implemented)
const productionChecks = {
  eslintErrors: () => runESLint() === 0,
  buildSuccess: () => runBuild().success,
  startupTime: () => measureStartup() < 3000,
  memoryUsage: () => measureMemory() < 200,
  ollamaIntegration: () => testOllamaAPI(),
  uiResponsiveness: () => testUILatency() < 100
};
```

### **Monitoring Integration (Future):**
1. **Error Tracking**: Implement crash reporting system
2. **Performance Metrics**: Track app startup, memory usage, response times
3. **User Feedback**: Integrated feedback system for production issues
4. **Health Checks**: Automated health monitoring for critical functions

---

## 🔧 IMPORTANT FIXES IMPLEMENTED

### External SSD Manifest Warning Fix (July 29, 2025)

**Issue**: Recurring `bad manifest name` warnings in Ollama logs
```
time=2025-07-29T15:33:44.351-05:00 level=WARN source=manifest.go:160 msg="bad manifest name" path=registry.ollama.ai/library/phi3/._mini
```

**Root Cause**: macOS resource fork files (`._*`) created when copying models to external SSD
- External SSD path: `/Volumes/Extreme SSD/ollama-models/`
- OLLAMA_MODELS environment variable correctly set
- macOS creates `._filename` metadata files on non-HFS+ drives

**Solution Applied**:
1. **Cleaned up existing junk files**: `find "/Volumes/Extreme SSD/ollama-models/" -name "._*" -type f -delete`
2. **Prevented future metadata**: Added `.metadata_never_index` to external SSD root
3. **Verified models still work**: `ollama list` shows phi3:mini accessible

**Result**: ✅ Clean logs, no more manifest warnings, improved performance

**For Future AI Models**: If manifest warnings return, check external drives for `._*` files and remove them safely.

### AI Session Continuity System (January 29, 2025)

**Issue**: Need to preserve conversation context when switching AI chat sessions/tabs
**Solution Implemented**:
1. **Created `AI_SESSION_CONTEXT.md`**: Complete project status, progress, and technical setup
2. **Created `NEW_AI_SESSION_PROMPT.md`**: Copy-paste template for new AI sessions
3. **Ensures seamless handoff**: New AI assistants understand full project context

**Files Created**:
- `docs/AI_SESSION_CONTEXT.md`: Living document with current progress and user preferences
- `docs/NEW_AI_SESSION_PROMPT.md`: Prompt template for session continuity

**Result**: ✅ AI session continuity achieved - new assistants can continue development seamlessly

**For Future AI Models**: Always read `docs/AI_SESSION_CONTEXT.md` first for current project status and working methodology.

---

**Last Updated**: January 29, 2025  
**Total Lines of Code**: ~6,000+  
**Current Status**: Session continuity system implemented, external SSD optimized, development workflow established
