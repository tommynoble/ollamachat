module.exports = {
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  globals: {
    // Electron renderer
    ipcRenderer: 'readonly',
    
    // Allow these for development
    console: 'readonly',
    process: 'readonly'
  },
  rules: {
    // Error prevention
    'no-unused-vars': 'warn',
    'no-undef': 'error',
    'no-redeclare': 'error',
    
    // Code quality
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Allow for development
    'no-console': 'off', // Allow console for debugging
    'no-debugger': 'warn', // Warn on debugger statements
    
    // Formatting (handled by Prettier)
    'quotes': 'off',
    'semi': 'off',
    'indent': 'off'
  }
};
