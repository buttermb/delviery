/**
 * Fix Lucide icon imports with numbers (e.g., trash2 -> trash-2)
 */

import * as fs from 'fs';
import * as path from 'path';

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z])(\d)/g, '$1-$2')
    .replace(/(\d)([A-Z])/g, '$1-$2')
    .toLowerCase();
}

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

// List of icon names with numbers that need fixing
const iconsWithNumbers = [
  'Trash2', 'CircleAlert', 'AlertCircle', 'Archive', 'ArrowBigDown', 'ArrowBigLeft',
  'ArrowBigRight', 'ArrowBigUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp',
  'Calendar', 'Check', 'ChevronDown', 'ChevronLeft', 'ChevronRight', 'ChevronUp',
  'Circle', 'Copy', 'Download', 'Edit', 'Edit2', 'Edit3', 'ExternalLink', 'Eye',
  'EyeOff', 'File', 'FileText', 'Filter', 'Folder', 'Grid', 'Hash', 'Heart',
  'HelpCircle', 'Home', 'Image', 'Info', 'Link', 'Link2', 'List', 'Loader',
  'Loader2', 'Lock', 'LogIn', 'LogOut', 'Mail', 'MapPin', 'Menu', 'MessageCircle',
  'MessageSquare', 'Mic', 'Minus', 'MoreHorizontal', 'MoreVertical', 'Move',
  'Package', 'Paperclip', 'Pause', 'Phone', 'Play', 'Plus', 'Power', 'Printer',
  'RefreshCw', 'Repeat', 'RotateCcw', 'RotateCw', 'Save', 'Search', 'Send',
  'Settings', 'Share', 'Share2', 'ShoppingBag', 'ShoppingCart', 'Shuffle', 'Sidebar',
  'SkipBack', 'SkipForward', 'Slack', 'Slash', 'Sliders', 'Smartphone', 'Square',
  'Star', 'Terminal', 'Thermometer', 'ThumbsDown', 'ThumbsUp', 'ToggleLeft',
  'ToggleRight', 'Tool', 'Trash', 'TrendingDown', 'TrendingUp', 'Triangle',
  'Truck', 'Tv', 'Twitter', 'Type', 'Umbrella', 'Underline', 'Unlock', 'Upload',
  'User', 'UserCheck', 'UserMinus', 'UserPlus', 'UserX', 'Users', 'Video', 'VideoOff',
  'Volume', 'Volume1', 'Volume2', 'VolumeX', 'Wifi', 'WifiOff', 'Wind', 'X',
  'XCircle', 'XSquare', 'Youtube', 'Zap', 'ZapOff', 'Zoom', 'ZoomIn', 'ZoomOut'
];

function fixFile(filePath: string): boolean {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // Find all lucide-react imports
    const importRegex = /from "lucide-react\/dist\/esm\/icons\/([^"]+)"/g;

    content = content.replace(importRegex, (match, iconPath) => {
      // Check if the icon path contains a number without proper hyphenation
      // e.g., trash2 should be trash-2
      if (/[a-z]\d/.test(iconPath)) {
        // Extract the icon name from the import statement
        const iconNameMatch = content.match(new RegExp(`import\\s+{\\s*([^}]+)\\s*}\\s+from\\s+"lucide-react/dist/esm/icons/${iconPath}"`));

        if (iconNameMatch) {
          const iconName = iconNameMatch[1].trim();
          const correctPath = toKebabCase(iconName);

          if (correctPath !== iconPath) {
            modified = true;
            return `from "lucide-react/dist/esm/icons/${correctPath}"`;
          }
        }
      }
      return match;
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

  console.log('🔍 Finding files with potentially incorrect icon paths...\n');
  const allFiles = findFiles(srcDir);

  let fixedFiles = 0;

  for (const file of allFiles) {
    if (fixFile(file)) {
      fixedFiles++;
    }
  }

  console.log(`\n✅ Fixed ${fixedFiles} files with incorrect icon paths`);
}

main();
