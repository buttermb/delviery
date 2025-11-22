import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '../src');

function walk(dir: string, callback: (filePath: string) => void) {
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
        let changed = false;

        // Replace console.log -> logger.debug
        if (content.includes('console.log(')) {
            content = content.replace(/console\.log\(/g, 'logger.debug(');
            changed = true;
        }
        // Replace console.error -> logger.error
        if (content.includes('console.error(')) {
            content = content.replace(/console\.error\(/g, 'logger.error(');
            changed = true;
        }
        // Replace console.warn -> logger.warn
        if (content.includes('console.warn(')) {
            content = content.replace(/console\.warn\(/g, 'logger.warn(');
            changed = true;
        }
        // Replace console.info -> logger.info
        if (content.includes('console.info(')) {
            content = content.replace(/console\.info\(/g, 'logger.info(');
            changed = true;
        }

        if (changed) {
            // Add logger import if missing
            if (!content.includes("import { logger } from '@/lib/logger';") && !content.includes('import { logger }')) {
                // Try to insert after the last import
                const lines = content.split('\n');
                let lastImportIndex = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].trim().startsWith('import ')) {
                        lastImportIndex = i;
                    }
                }

                if (lastImportIndex !== -1) {
                    lines.splice(lastImportIndex + 1, 0, "import { logger } from '@/lib/logger';");
                } else {
                    lines.unshift("import { logger } from '@/lib/logger';");
                }
                content = lines.join('\n');
            }

            fs.writeFileSync(filePath, content);
            console.log(`Updated ${filePath}`);
        }
    }
});
