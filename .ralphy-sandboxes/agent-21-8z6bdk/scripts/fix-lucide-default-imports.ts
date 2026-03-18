/**
 * Fix Lucide icon imports to use default imports instead of named imports
 * Transforms: import { Icon } from "lucide-react/dist/esm/icons/icon"
 * To: import Icon from "lucide-react/dist/esm/icons/icon"
 */

import * as fs from 'fs';
import * as path from 'path';

function findFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === '.ralphy-worktrees'
      ) {
        continue;
      }
      findFiles(fullPath, files);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.tsx') ||
        entry.name.endsWith('.ts') ||
        entry.name.endsWith('.jsx') ||
        entry.name.endsWith('.js'))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function fixFile(filePath: string): boolean {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // Transform named imports to default imports for lucide-react icons
    const importRegex = /import\s+{\s*([^}]+)\s*}\s+from\s+"lucide-react\/dist\/esm\/icons\/([^"]+)";/g;

    content = content.replace(importRegex, (match, iconName, iconPath) => {
      modified = true;
      const trimmedIconName = iconName.trim();
      return `import ${trimmedIconName} from "lucide-react/dist/esm/icons/${iconPath}";`;
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

function main() {
  const rootDir = process.cwd();
  const srcDir = path.join(rootDir, 'src');

  console.log('🔍 Finding files with named Lucide imports...\n');
  const allFiles = findFiles(srcDir);

  let fixedFiles = 0;

  for (const file of allFiles) {
    if (fixFile(file)) {
      fixedFiles++;
      if (fixedFiles % 100 === 0) {
        console.log(`Fixed ${fixedFiles} files...`);
      }
    }
  }

  console.log(`\n✅ Fixed ${fixedFiles} files to use default imports`);
}

main();
