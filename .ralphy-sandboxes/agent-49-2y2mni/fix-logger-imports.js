#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript/TSX files
const files = glob.sync('src/**/*.{ts,tsx}', {
  ignore: ['**/*.d.ts', '**/node_modules/**']
});

let fixed = 0;
let errors = 0;

files.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Remove all logger imports (both lib and utils)
    content = content.replace(/^import\s+{\s*logger\s*}\s+from\s+['"]@\/(lib|utils)\/logger['"];?\s*\n/gm, '');
    
    // Add single logger import at the top after first import or at the beginning
    const hasImports = /^import\s/.test(content);
    
    if (hasImports) {
      // Find the position after the first import block
      const lines = content.split('\n');
      let insertIndex = 0;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          insertIndex = i + 1;
        } else if (insertIndex > 0 && lines[i].trim() !== '') {
          break;
        }
      }
      
      // Check if logger import already exists
      if (!content.includes("import { logger } from '@/lib/logger'")) {
        lines.splice(insertIndex, 0, "import { logger } from '@/lib/logger';");
        content = lines.join('\n');
      }
    } else {
      // No imports, add at the beginning
      if (!content.includes("import { logger } from '@/lib/logger'")) {
        content = "import { logger } from '@/lib/logger';\n\n" + content;
      }
    }
    
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

console.log(`\nDone! Fixed ${fixed} files. Errors: ${errors}`);
