#!/usr/bin/env node

/**
 * Comprehensive Duplicate Logger Import Fixer
 * 
 * This script fixes ALL duplicate logger imports across the codebase by:
 * 1. Removing ALL logger imports (from both @/lib/logger and @/utils/logger)
 * 2. Inserting a single correct import at the appropriate location
 * 3. Preserving all other imports and code structure
 */

const fs = require('fs');
const path = require('path');

let fixedFiles = 0;
let totalFiles = 0;
let errorFiles = [];

function walkDirectory(dir, callback) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Skip node_modules and dist
            if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
                walkDirectory(filePath, callback);
            }
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            callback(filePath);
        }
    }
}

function fixLoggerImports(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        // Regex pattern to match logger imports with any quote style and any path
        // Matches: @/lib/logger, @/utils/logger, ./logger, ../logger, etc.
        // Also matches imports that include logger along with other exports: { logger, log }
        const loggerImportPattern = /^\s*import\s+\{[^}]*\blogger\b[^}]*\}\s+from\s+['"](@\/(lib|utils)\/logger|\.\/logger|\.\.\/.*logger)['"]/;

        // Check if file has any logger imports
        const hasLoggerImport = lines.some(line => loggerImportPattern.test(line));

        if (!hasLoggerImport) {
            return false; // No logger imports, nothing to fix
        }

        // Count logger imports to detect duplicates
        const loggerImportCount = lines.filter(line => loggerImportPattern.test(line)).length;

        // Check if there's a correct import from @/lib/logger
        const hasCorrectImport = lines.some(line => 
            /^\s*import\s+\{\s*logger\s*\}\s+from\s+['"]@\/lib\/logger['"]/.test(line)
        );

        // If there's exactly one import and it's correct, nothing to fix
        if (loggerImportCount === 1 && hasCorrectImport) {
            return false; // Already correct, nothing to fix
        }

        // Remove ALL logger imports (handles @/lib/logger, @/utils/logger, ./logger, relative paths, any quote style)
        const cleanedLines = lines.filter(line => !loggerImportPattern.test(line));

        // Find the correct insertion point
        let insertIndex = 0;
        let foundFirstImport = false;

        for (let i = 0; i < cleanedLines.length; i++) {
            const line = cleanedLines[i].trim();

            // Skip comments and empty lines at the start
            if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line === '') {
                continue;
            }

            // First non-comment line should be an import
            if (line.startsWith('import ')) {
                insertIndex = i;
                foundFirstImport = true;
                break;
            }

            // If we hit non-import code, insert before it
            if (line && !line.startsWith('import')) {
                insertIndex = i;
                break;
            }
        }

        // If no imports found, insert at the beginning (after initial comments)
        if (!foundFirstImport) {
            for (let i = 0; i < cleanedLines.length; i++) {
                const line = cleanedLines[i].trim();
                if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
                    insertIndex = i;
                    break;
                }
            }
        }

        // Insert the correct logger import
        cleanedLines.splice(insertIndex, 0, "import { logger } from '@/lib/logger';");

        // Write back to file
        fs.writeFileSync(filePath, cleanedLines.join('\n'), 'utf-8');

        return true;
    } catch (error) {
        errorFiles.push({ path: filePath, error: error.message });
        return false;
    }
}

// Main execution
console.log('🔍 Scanning for duplicate logger imports...\n');

const srcDir = path.join(__dirname, '../src');

walkDirectory(srcDir, (filePath) => {
    totalFiles++;
    if (fixLoggerImports(filePath)) {
        fixedFiles++;
        const relativePath = path.relative(srcDir, filePath);
        console.log(`✅ Fixed: ${relativePath}`);
    }
});

console.log('\n' + '='.repeat(60));
console.log('📊 **Fix Summary**');
console.log('='.repeat(60));
console.log(`Total files scanned:  ${totalFiles}`);
console.log(`Files fixed:          ${fixedFiles}`);
console.log(`Files with errors:    ${errorFiles.length}`);
console.log('='.repeat(60));

if (errorFiles.length > 0) {
    console.log('\n⚠️  **Files with errors:**');
    errorFiles.forEach(({ path: filePath, error }) => {
        console.log(`   ${path.relative(srcDir, filePath)}: ${error}`);
    });
}

if (fixedFiles > 0) {
    console.log('\n✨ **Next steps:**');
    console.log('1. Run TypeScript check: npx tsc --noEmit');
    console.log('2. Test the build: npm run build');
    console.log('3. Start dev server: npm run dev');
}

console.log('');
