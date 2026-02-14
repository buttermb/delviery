#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript/TSX files
const files = glob.sync('src/**/*.{ts,tsx}', {
  ignore: ['**/*.d.ts', '**/node_modules/**', '**/types.ts']
});

let fixed = 0;
let errors = 0;

console.log(`\n🔍 Scanning ${files.length} files for duplicate logger imports...\n`);

files.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Check if file uses logger
    const usesLogger = /\blogger\.(debug|info|warn|error)\b/.test(content);
    
    // Remove ALL logger imports (both lib and utils)
    const loggerImportPattern = /^import\s*{\s*logger\s*}\s*from\s*['"]@\/(lib|utils)\/logger['"];?\s*\n/gm;
    content = content.replace(loggerImportPattern, '');
    
    // If file uses logger, add single import at the top
    if (usesLogger) {
      const lines = content.split('\n');
      let insertIndex = 0;
      let inCommentBlock = false;
      
      // Find the right position after comments but before other imports
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Track multi-line comments
        if (line.startsWith('/*')) inCommentBlock = true;
        if (line.endsWith('*/')) inCommentBlock = false;
        
        // Skip single-line comments and empty lines at the start
        if (line.startsWith('//') || line.startsWith('/*') || inCommentBlock || line === '') {
          insertIndex = i + 1;
          continue;
        }
        
        // Stop at first import or code
        if (line.startsWith('import ') || (line !== '' && !line.startsWith('//'))) {
          break;
        }
      }
      
      // Check if logger import already exists
      const hasLoggerImport = /import\s*{\s*logger\s*}\s*from\s*['"]@\/lib\/logger['"]/.test(content);
      
      if (!hasLoggerImport) {
        lines.splice(insertIndex, 0, "import { logger } from '@/lib/logger';");
        content = lines.join('\n');
      }
    }
    
    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed: ${filePath}`);
      fixed++;
    }
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    errors++;
  }
});

console.log(`\n✅ Complete!`);
console.log(`   Fixed: ${fixed} files`);
console.log(`   Errors: ${errors} files`);
console.log(`\nYour site should now build successfully! 🚀\n`);
