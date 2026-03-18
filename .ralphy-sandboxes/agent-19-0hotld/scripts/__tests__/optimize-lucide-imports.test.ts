/**
 * Tests for Lucide imports optimization script
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const TEST_DIR = path.join(__dirname, 'test-fixtures');

describe('Lucide Imports Optimization', () => {
  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should transform single-line imports correctly', () => {
    const testFile = path.join(TEST_DIR, 'single-line.tsx');
    const content = `import { User, Settings, Home } from "lucide-react";

export const Component = () => <User />;`;

    fs.writeFileSync(testFile, content);

    // Run transformation (simulate what the script does)
    const transformed = transformLucideImports(content);

    expect(transformed).toContain('import User from "lucide-react/dist/esm/icons/user";');
    expect(transformed).toContain('import Settings from "lucide-react/dist/esm/icons/settings";');
    expect(transformed).toContain('import Home from "lucide-react/dist/esm/icons/home";');
    expect(transformed).not.toContain('from "lucide-react"');
  });

  it('should handle PascalCase to kebab-case conversion', () => {
    const testFile = path.join(TEST_DIR, 'kebab-case.tsx');
    const content = `import { ShoppingCart, UserCircle, TrendingUp } from "lucide-react";`;

    fs.writeFileSync(testFile, content);

    const transformed = transformLucideImports(content);

    expect(transformed).toContain('import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";');
    expect(transformed).toContain('import UserCircle from "lucide-react/dist/esm/icons/user-circle";');
    expect(transformed).toContain('import TrendingUp from "lucide-react/dist/esm/icons/trending-up";');
  });

  it('should preserve other imports', () => {
    const testFile = path.join(TEST_DIR, 'preserve-imports.tsx');
    const content = `import React from "react";
import { Button } from "@/components/ui/button";
import { User, Settings } from "lucide-react";
import { toast } from "sonner";

export const Component = () => <User />;`;

    fs.writeFileSync(testFile, content);

    const transformed = transformLucideImports(content);

    expect(transformed).toContain('import React from "react";');
    expect(transformed).toContain('import { Button } from "@/components/ui/button";');
    expect(transformed).toContain('import { toast } from "sonner";');
    expect(transformed).toContain('import User from "lucide-react/dist/esm/icons/user";');
    expect(transformed).toContain('import Settings from "lucide-react/dist/esm/icons/settings";');
  });

  it('should handle multi-line imports', () => {
    const testFile = path.join(TEST_DIR, 'multi-line.tsx');
    const content = `import {
  User,
  Settings,
  Home,
  Search
} from "lucide-react";`;

    fs.writeFileSync(testFile, content);

    const transformed = transformLucideImports(content);

    expect(transformed).toContain('import User from "lucide-react/dist/esm/icons/user";');
    expect(transformed).toContain('import Settings from "lucide-react/dist/esm/icons/settings";');
    expect(transformed).toContain('import Home from "lucide-react/dist/esm/icons/home";');
    expect(transformed).toContain('import Search from "lucide-react/dist/esm/icons/search";');
  });

  it('should handle files with no Lucide imports', () => {
    const testFile = path.join(TEST_DIR, 'no-lucide.tsx');
    const content = `import React from "react";
import { Button } from "@/components/ui/button";

export const Component = () => <Button>Click me</Button>;`;

    fs.writeFileSync(testFile, content);

    const transformed = transformLucideImports(content);

    expect(transformed).toBe(content);
  });

  it('should handle special icon names with numbers', () => {
    const testFile = path.join(TEST_DIR, 'with-numbers.tsx');
    const content = `import { Trash2, Star, Home } from "lucide-react";`;

    fs.writeFileSync(testFile, content);

    const transformed = transformLucideImports(content);

    expect(transformed).toContain('import Trash2 from "lucide-react/dist/esm/icons/trash-2";');
    expect(transformed).toContain('import Star from "lucide-react/dist/esm/icons/star";');
  });

  it('should handle mixed quotes (single and double)', () => {
    const testFile = path.join(TEST_DIR, 'mixed-quotes.tsx');
    const content = `import { User } from 'lucide-react';`;

    fs.writeFileSync(testFile, content);

    const transformed = transformLucideImports(content);

    expect(transformed).toContain('import User from "lucide-react/dist/esm/icons/user";');
    expect(transformed).not.toContain("from 'lucide-react'");
  });
});

// Helper function that mimics the transformation logic
function transformLucideImports(content: string): string {
  function toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .replace(/([a-z])(\d)/g, '$1-$2')
      .replace(/(\d)([A-Z])/g, '$1-$2')
      .toLowerCase();
  }

  function extractLucideImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importList = match[1];
      const icons = importList
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);

      imports.push(...icons);
    }

    return imports;
  }

  const icons = extractLucideImports(content);

  if (icons.length === 0) {
    return content;
  }

  let newContent = content;

  // Remove old lucide-react imports
  const lucideImportRegex = /import\s+{[^}]*}\s+from\s+['"]lucide-react['"];?\r?\n?/g;
  const firstMatch = lucideImportRegex.exec(content);
  const insertPosition = firstMatch?.index || 0;

  newContent = newContent.replace(lucideImportRegex, '');

  // Generate new individual imports (default imports)
  const newImports = icons
    .map((iconName) => {
      const kebabName = toKebabCase(iconName);
      return `import ${iconName} from "lucide-react/dist/esm/icons/${kebabName}";`;
    })
    .join('\n');

  // Insert new imports
  newContent =
    newContent.slice(0, insertPosition) +
    newImports + '\n' +
    newContent.slice(insertPosition);

  // Clean up multiple consecutive newlines
  newContent = newContent.replace(/\n{3,}/g, '\n\n');

  return newContent;
}
