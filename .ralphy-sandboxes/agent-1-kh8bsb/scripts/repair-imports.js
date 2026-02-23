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

        // Check if file has the logger import
        if (content.includes("import { logger } from '@/lib/logger';")) {
            // Remove all occurrences
            const lines = content.split('\n');
            const cleanLines = lines.filter(line => !line.trim().includes("import { logger } from '@/lib/logger';"));

            // Re-insert properly
            let newContent = cleanLines.join('\n');

            // Find the last import statement ending
            // We look for ";\n" or ";\r\n" that follows a "from" or just the end of an import line
            // A simple heuristic: find the last line starting with "import" or containing " from " and ending with ";"

            let insertIndex = -1;
            for (let i = 0; i < cleanLines.length; i++) {
                const line = cleanLines[i].trim();
                if (line.startsWith('import') || line.includes(' from ')) {
                    if (line.endsWith(';')) {
                        insertIndex = i;
                    }
                }
            }

            // If we found an import, insert after it
            if (insertIndex !== -1) {
                cleanLines.splice(insertIndex + 1, 0, "import { logger } from '@/lib/logger';");
            } else {
                // No imports found, or weird formatting. Insert at top.
                cleanLines.unshift("import { logger } from '@/lib/logger';");
            }

            const finalContent = cleanLines.join('\n');

            if (finalContent !== content) {
                fs.writeFileSync(filePath, finalContent);
                console.log(`Repaired ${filePath}`);
            }
        }
    }
});
