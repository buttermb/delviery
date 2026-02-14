
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '../src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(rootDir);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Replace console.log/info/warn/error
    if (content.includes('console.log') || content.includes('console.info') || content.includes('console.warn') || content.includes('console.error')) {

        // Check if logger is imported
        if (!content.includes("from '@/lib/logger'") && !content.includes('from "@/lib/logger"')) {
            // Add import
            // specific logic to add it at the top
            const importStatement = "import { logger } from '@/lib/logger';\n";
            content = importStatement + content;
        }

        // Replacements
        if (content.includes('console.log')) {
            content = content.replace(/console\.log\(/g, 'logger.info(');
            changed = true;
        }
        if (content.includes('console.info')) {
            content = content.replace(/console\.info\(/g, 'logger.info(');
            changed = true;
        }
        if (content.includes('console.warn')) {
            content = content.replace(/console\.warn\(/g, 'logger.warn(');
            changed = true;
        }
        if (content.includes('console.error')) {
            content = content.replace(/console\.error\(/g, 'logger.error(');
            changed = true;
        }

        if (changed) {
            console.log(`Updated ${file}`);
            fs.writeFileSync(file, content, 'utf8');
        }
    }
});
