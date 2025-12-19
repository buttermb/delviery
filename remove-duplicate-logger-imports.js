const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const files = getAllFiles('./src');
let fixed = 0;

files.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Remove the duplicate @/utils/logger import
    const utilsLoggerPattern = /import\s*{\s*logger\s*}\s*from\s*['"]@\/utils\/logger['"];?\s*\n/g;
    content = content.replace(utilsLoggerPattern, '');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed: ${filePath}`);
      fixed++;
    }
  } catch (error) {
    console.error(`✗ Error: ${filePath} - ${error.message}`);
  }
});

console.log(`\nDone! Fixed ${fixed} files.`);
