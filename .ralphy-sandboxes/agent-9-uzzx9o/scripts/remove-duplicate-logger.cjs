const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      callback(filePath);
    }
  });
}

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Check if line 1 is the duplicate logger import
    if (lines[0] === "import { logger } from '@/lib/logger';") {
      // Check if there's another logger import later in the file
      const hasOtherLoggerImport = lines.slice(1).some(line => 
        line.includes("import { logger } from") || 
        line.includes("from '@/lib/logger'") ||
        line.includes("from '@/utils/logger'")
      );
      
      if (hasOtherLoggerImport) {
        // Remove the first line (duplicate)
        lines.shift();
        const newContent = lines.join('\n');
        fs.writeFileSync(filePath, newContent, 'utf-8');
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

const srcDir = path.join(__dirname, '../src');
let fixedCount = 0;
let totalFiles = 0;

console.log('Starting duplicate logger import removal...\n');

walkDir(srcDir, (filePath) => {
  totalFiles++;
  if (fixFile(filePath)) {
    fixedCount++;
    console.log(`✓ Fixed: ${path.relative(srcDir, filePath)}`);
  }
});

console.log(`\n✅ Complete!`);
console.log(`Fixed ${fixedCount} files out of ${totalFiles} total files`);

