import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '../src');

function walk(dir, callback) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walk(filePath, callback);
        } else {
            callback(filePath);
        }
    });
}

function fixFile(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
        return false;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Check if file uses logger
    if (!content.includes('logger.')) {
        return false;
    }

    const lines = content.split('\n');
    
    // Remove ALL logger imports
    const cleanLines = lines.filter(line => 
        !line.trim().includes("import { logger } from '@/lib/logger';") &&
        !line.trim().includes('import { logger } from "@/lib/logger";')
    );
    
    // Find the right place to insert the import
    let insertIndex = 0;
    let foundFirstImport = false;
    
    for (let i = 0; i < cleanLines.length; i++) {
        const line = cleanLines[i].trim();
        
        // Skip empty lines, comments, and directives at the start
        if (!line || 
            line.startsWith('//') || 
            line.startsWith('/*') || 
            line.startsWith('*') ||
            line.includes("'use client'") ||
            line.includes('"use client"') ||
            line.includes("'use strict'") ||
            line.includes('"use strict"')) {
            insertIndex = i + 1;
            continue;
        }
        
        // If we hit an import statement, remember this position
        if (line.startsWith('import')) {
            if (!foundFirstImport) {
                insertIndex = i;
                foundFirstImport = true;
            }
            continue;
        }
        
        // If we've found imports and now hit non-import code, break
        if (foundFirstImport && !line.startsWith('import')) {
            break;
        }
        
        // If no imports found yet and we hit code, insert at current position
        if (!foundFirstImport && line && !line.startsWith('//')) {
            break;
        }
    }
    
    // Insert the logger import at the determined position
    cleanLines.splice(insertIndex, 0, "import { logger } from '@/lib/logger';");
    
    const newContent = cleanLines.join('\n');
    
    if (newContent !== originalContent) {
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`✓ Fixed: ${filePath}`);
        return true;
    }
    
    return false;
}

let fixedCount = 0;
let totalFiles = 0;

walk(srcDir, (filePath) => {
    totalFiles++;
    if (fixFile(filePath)) {
        fixedCount++;
    }
});

console.log(`\n✓ Complete: Fixed ${fixedCount} files out of ${totalFiles} total files`);
