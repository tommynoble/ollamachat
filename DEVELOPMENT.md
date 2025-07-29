# 🛠 Development Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Workflow

#### Option A: Separate Terminals (Recommended)
```bash
# Terminal 1: Frontend with hot reload
npm run dev

# Terminal 2: Electron app with auto-restart
npm run dev:electron
```

#### Option B: All-in-one
```bash
npm run dev:full
```

### 3. Code Quality

#### Format Code
```bash
npm run format
```

#### Check Code Quality
```bash
npm run lint
```

#### Fix Common Issues
```bash
npm run lint --fix
```

## Development Tools Installed ✅

### **ESLint** - Code Quality
- Catches common JavaScript errors
- Enforces consistent code style
- Configuration: `.eslintrc.js`

### **Prettier** - Code Formatting
- Auto-formats your code consistently
- Configuration: `.prettierrc`

### **Vite** - Fast Development Server
- Hot reload for HTML/CSS/JS changes
- Configuration: `vite.config.js`
- Runs on: http://localhost:3000

### **Nodemon** - Auto-restart Electron
- Automatically restarts Electron when main.js changes
- Configuration: `nodemon.json`

## File Structure

```
ollamachat/
├── .eslintrc.js          # ESLint configuration
├── .prettierrc           # Prettier configuration  
├── vite.config.js        # Vite configuration
├── nodemon.json          # Nodemon configuration
├── main.js               # Electron main process
├── renderer.js           # Frontend JavaScript
├── index.html            # Main HTML
├── style.css             # Styles
└── api/                  # Python backend scripts
```

## Tips

### Hot Reload
- **Frontend changes** (HTML/CSS/JS): Auto-refresh via Vite
- **Backend changes** (main.js, Python): Auto-restart via Nodemon

### Code Quality
- Run `npm run format` before committing
- ESLint warnings are okay, errors should be fixed
- Prettier handles all formatting automatically

### Debugging
- Use browser DevTools in Electron (Ctrl+Shift+I)
- Console logs work normally
- Main process logs appear in terminal

### Mobile Development (Future)
- Vite server allows network access: `http://your-ip:3000`
- Your glassmorphism UI will work on mobile browsers

## Common Commands

```bash
# Start development
npm run dev:full

# Format all code
npm run format

# Check for issues
npm run lint

# Check production readiness
npm run production-check

# Build for production
npm run build

# Start production app
npm start
```

## Next Steps

Following the **PROJECT_SCALING_PLAN.md**:

1. ✅ **Phase 1 Started**: Basic development tools setup
2. **Next**: CSS modularization (break down style.css)
3. **Then**: JavaScript componentization
4. **Future**: Plugin system, themes, mobile support

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000
```

### ESLint Errors
Most warnings are okay. Fix errors first:
```bash
npm run lint
```

### Electron Won't Start
Check main.js syntax:
```bash
node -c main.js
``` 