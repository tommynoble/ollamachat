#!/usr/bin/env node
/**
 * Production Readiness Check Script
 * Run with: node scripts/production-check.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Production Readiness Check\n');

const checks = [];
let passed = 0;
let failed = 0;

function check(name, testFn) {
  try {
    const result = testFn();
    if (result.success) {
      console.log(`✅ ${name}: ${result.message || 'PASSED'}`);
      passed++;
    } else {
      console.log(`❌ ${name}: ${result.message || 'FAILED'}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    failed++;
  }
}

// 1. ESLint Check
check('ESLint Errors', () => {
  try {
    execSync('npm run lint', { stdio: 'pipe' });
    return { success: true, message: 'No critical errors found' };
  } catch (error) {
    const output = error.stdout?.toString() || error.message;
    const errorCount = (output.match(/error/g) || []).length;
    const warningCount = (output.match(/warning/g) || []).length;
    
    if (errorCount === 0) {
      return { success: true, message: `${warningCount} warnings (acceptable)` };
    } else {
      return { success: false, message: `${errorCount} errors, ${warningCount} warnings` };
    }
  }
});

// 2. Required Files Check
check('Required Files', () => {
  const requiredFiles = [
    'main.js',
    'renderer.js', 
    'index.html',
    'style.css',
    'package.json',
    'PROJECT_RULES.md',
    'PROJECT_SCALING_PLAN.md'
  ];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length === 0) {
    return { success: true, message: 'All required files present' };
  } else {
    return { success: false, message: `Missing: ${missingFiles.join(', ')}` };
  }
});

// 3. Package.json Validation
check('Package.json Scripts', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = ['start', 'dev', 'build', 'lint', 'format'];
  
  const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);
  
  if (missingScripts.length === 0) {
    return { success: true, message: 'All required scripts present' };
  } else {
    return { success: false, message: `Missing scripts: ${missingScripts.join(', ')}` };
  }
});

// 4. Configuration Files
check('Development Configuration', () => {
  const configFiles = [
    '.eslintrc.js',
    '.prettierrc',
    'vite.config.js',
    'nodemon.json'
  ];
  
  const missingConfigs = configFiles.filter(file => !fs.existsSync(file));
  
  if (missingConfigs.length === 0) {
    return { success: true, message: 'All config files present' };
  } else {
    return { success: false, message: `Missing configs: ${missingConfigs.join(', ')}` };
  }
});

// 5. File Size Check
check('File Size Monitoring', () => {
  const fileSizes = {
    'style.css': fs.statSync('style.css').size,
    'renderer.js': fs.statSync('renderer.js').size,
    'main.js': fs.statSync('main.js').size
  };
  
  const warnings = [];
  
  // Check for oversized files
  if (fileSizes['style.css'] > 500000) warnings.push('style.css is very large (>500KB)');
  if (fileSizes['renderer.js'] > 300000) warnings.push('renderer.js is very large (>300KB)');
  if (fileSizes['main.js'] > 200000) warnings.push('main.js is very large (>200KB)');
  
  if (warnings.length === 0) {
    return { success: true, message: 'File sizes reasonable' };
  } else {
    return { success: false, message: warnings.join('; ') };
  }
});

// 6. Security Check (Basic)
check('Security - No Hardcoded Secrets', () => {
  const filesToCheck = ['main.js', 'renderer.js'];
  const suspiciousPatterns = [
    /password\s*=\s*["'][^"']*["']/i,
    /api_key\s*=\s*["'][^"']*["']/i,
    /secret\s*=\s*["'][^"']*["']/i,
    /token\s*=\s*["'][a-zA-Z0-9]{20,}["']/i
  ];
  
  const foundSecrets = [];
  
  filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      suspiciousPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          foundSecrets.push(`Potential secret in ${file}`);
        }
      });
    }
  });
  
  if (foundSecrets.length === 0) {
    return { success: true, message: 'No obvious hardcoded secrets found' };
  } else {
    return { success: false, message: foundSecrets.join('; ') };
  }
});

// 7. Build Test
check('Build Process', () => {
  try {
    execSync('npm run build', { stdio: 'pipe' });
    return { success: true, message: 'Build completed successfully' };
  } catch (error) {
    return { success: false, message: 'Build failed - check configuration' };
  }
});

// Results Summary
console.log('\n📊 Production Readiness Summary');
console.log('================================');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${passed + failed}`);

const readinessScore = (passed / (passed + failed)) * 100;
console.log(`🎯 Readiness Score: ${readinessScore.toFixed(1)}%`);

if (readinessScore >= 85) {
  console.log('\n🚀 Ready for production deployment!');
  process.exit(0);
} else if (readinessScore >= 70) {
  console.log('\n⚠️  Nearly ready - address failed checks before production');
  process.exit(1);
} else {
  console.log('\n🔴 Not ready for production - significant issues need addressing');
  process.exit(1);
} 