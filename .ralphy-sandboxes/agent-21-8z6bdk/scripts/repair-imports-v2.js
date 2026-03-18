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

walk(srcDir, (filePath) => {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        let content = fs.readFileSync(filePath, 'utf-8');
        const originalContent = content;

        // 1. Remove all existing logger imports
        const lines = content.split('\n');
        const cleanLines = lines.filter(line => !line.trim().includes("import { logger } from '@/lib/logger';"));
        let newContent = cleanLines.join('\n');

        // 2. Check if logger is used
        if (newContent.includes('logger.')) {
            // 3. Insert import at the top
            // We need to be careful about directives like 'use client' or comments

            let insertIndex = 0;
            // Skip leading comments or empty lines or directives
            for (let i = 0; i < cleanLines.length; i++) {
                const line = cleanLines[i].trim();
                if (!line) continue;
                if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
                if (line.startsWith("'use client'") || line.startsWith('"use client"')) {
                    insertIndex = i + 1;
                    continue;
                }
                // If we hit an import or code, stop
                break;
            }

            cleanLines.splice(insertIndex, 0, "import { logger } from '@/lib/logger';");
            newContent = cleanLines.join('\n');
        }

        if (newContent !== originalContent) {
            fs.writeFileSync(filePath, newContent);
            console.log(`Repaired ${filePath}`);
        }
    }
});
