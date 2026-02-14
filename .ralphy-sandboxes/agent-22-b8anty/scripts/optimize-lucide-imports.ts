/**
 * Script to optimize Lucide React imports
 * Transforms: import { Icon1, Icon2 } from "lucide-react"
 * To: import { Icon1 } from "lucide-react/dist/esm/icons/icon1"
 *     import { Icon2 } from "lucide-react/dist/esm/icons/icon2"
 */

import * as fs from 'fs';
import * as path from 'path';

interface FileResult {
  file: string;
  icons: string[];
  success: boolean;
  error?: string;
}

// Convert PascalCase to kebab-case
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')  // Handle lowercase followed by uppercase
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')  // Handle uppercase followed by uppercase+lowercase
    .replace(/([a-z])(\d)/g, '$1-$2')  // Handle lowercase followed by number
    .replace(/(\d)([A-Z])/g, '$1-$2')  // Handle number followed by uppercase
    .toLowerCase();
}

// Find all TypeScript/JavaScript files
function findFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip node_modules, .git, and build directories
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

// Extract Lucide imports from a file using regex
function extractLucideImports(content: string): string[] {
  const imports: string[] = [];

  // Match single-line and multi-line imports from lucide-react
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importList = match[1];
    // Split by comma and extract icon names
    const icons = importList
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    imports.push(...icons);
  }

  return imports;
}

// Transform a single file
function transformFile(filePath: string): FileResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const icons = extractLucideImports(content);

    if (icons.length === 0) {
      return { file: filePath, icons: [], success: true };
    }

    let newContent = content;

    // Remove old lucide-react imports (including multi-line)
    const lucideImportRegex = /import\s+{[^}]*}\s+from\s+['"]lucide-react['"];?\r?\n?/g;

    // Store the position of the first lucide import to replace it with new imports
    const firstMatch = lucideImportRegex.exec(content);
    const insertPosition = firstMatch?.index || 0;

    // Remove all lucide-react imports
    newContent = newContent.replace(lucideImportRegex, '');

    // Generate new individual imports (default imports)
    const newImports = icons
      .map((iconName) => {
        const kebabName = toKebabCase(iconName);
        return `import ${iconName} from "lucide-react/dist/esm/icons/${kebabName}";`;
      })
      .join('\n');

    // Insert new imports at the position of the first lucide import
    newContent =
      newContent.slice(0, insertPosition) +
      newImports + '\n' +
      newContent.slice(insertPosition);

    // Clean up multiple consecutive newlines
    newContent = newContent.replace(/\n{3,}/g, '\n\n');

    fs.writeFileSync(filePath, newContent, 'utf-8');

    return {
      file: filePath,
      icons: icons,
      success: true,
    };
  } catch (error) {
    return {
      file: filePath,
      icons: [],
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Main execution
function main() {
  const rootDir = process.cwd();
  const srcDir = path.join(rootDir, 'src');

  console.log('🔍 Finding files with Lucide imports...\n');
  const allFiles = findFiles(srcDir);
  console.log(`Found ${allFiles.length} TypeScript/JavaScript files\n`);

  const results: FileResult[] = [];
  let processedFiles = 0;
  let filesWithImports = 0;

  for (const file of allFiles) {
    const result = transformFile(file);
    results.push(result);

    if (result.icons.length > 0) {
      filesWithImports++;
      processedFiles++;

      if (processedFiles % 50 === 0) {
        console.log(`Processed ${processedFiles} files with Lucide imports...`);
      }
    }
  }

  // Summary
  console.log('\n✅ Transformation complete!\n');
  console.log(`📊 Summary:`);
  console.log(`  - Total files scanned: ${allFiles.length}`);
  console.log(`  - Files with Lucide imports: ${filesWithImports}`);
  console.log(`  - Successfully transformed: ${results.filter((r) => r.success && r.icons.length > 0).length}`);

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.log(`  - Failed: ${failures.length}\n`);
    console.log('❌ Failed files:');
    failures.forEach((f) => {
      console.log(`  - ${f.file}: ${f.error}`);
    });
  }

  // Show some examples
  const examples = results.filter((r) => r.icons.length > 0).slice(0, 5);
  if (examples.length > 0) {
    console.log('\n📝 Example transformations:');
    examples.forEach((ex) => {
      console.log(`  - ${path.relative(rootDir, ex.file)}`);
      console.log(`    Icons: ${ex.icons.join(', ')}`);
    });
  }
}

main();
