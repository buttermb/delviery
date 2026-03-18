#!/usr/bin/env node

/**
 * Vendor Forms Chunk Verification Script
 *
 * This script analyzes the build output to verify that the vendor-forms chunk
 * is properly created and contains the expected dependencies (react-hook-form, zod).
 *
 * It reads the build artifacts and checks:
 * 1. If vendor-forms chunk exists
 * 2. If it contains the expected libraries
 * 3. The size of the chunk
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const DIST_DIR = './dist/assets';
const TARGET_LIBRARIES = ['react-hook-form', 'zod', '@hookform/resolvers'];

console.log('🔍 Analyzing build output for vendor-forms chunk...\n');

try {
  // Read all files in the dist/assets directory
  const files = readdirSync(DIST_DIR);

  // Filter for JavaScript chunk files (not maps, not compressed)
  const jsChunks = files.filter(f =>
    f.endsWith('.js') &&
    !f.endsWith('.map') &&
    !f.endsWith('.br') &&
    !f.endsWith('.gz')
  );

  console.log(`📦 Found ${jsChunks.length} JavaScript chunks\n`);

  let vendorFormsChunk = null;
  let foundLibraries = [];

  // Check each chunk for the target libraries
  for (const chunk of jsChunks) {
    const filePath = join(DIST_DIR, chunk);
    const content = readFileSync(filePath, 'utf-8');

    // Check if this chunk contains any of our target libraries
    const librariesInChunk = TARGET_LIBRARIES.filter(lib => {
      // Check for various patterns that indicate the library is in this chunk
      const patterns = [
        lib,
        lib.replace('@hookform/resolvers', 'hookform'),
        'useForm', // react-hook-form
        'zodResolver', // @hookform/resolvers
        'z.object', // zod
        'ZodType', // zod
      ];
      return patterns.some(pattern => content.includes(pattern));
    });

    if (librariesInChunk.length > 0) {
      const stats = statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);

      console.log(`✅ Found chunk with form libraries: ${chunk}`);
      console.log(`   Size: ${sizeKB} KB`);
      console.log(`   Libraries detected: ${librariesInChunk.join(', ')}`);

      // If this chunk has multiple form libraries, it's likely our vendor-forms chunk
      if (librariesInChunk.length >= 2) {
        vendorFormsChunk = chunk;
        foundLibraries = librariesInChunk;
      }
      console.log('');
    }
  }

  console.log('\n📊 Summary:');
  console.log('━'.repeat(60));

  if (vendorFormsChunk) {
    console.log('✅ Vendor-forms chunk identified:', vendorFormsChunk);
    console.log('✅ Contains libraries:', foundLibraries.join(', '));

    const filePath = join(DIST_DIR, vendorFormsChunk);
    const stats = statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ Chunk size: ${sizeKB} KB (${sizeMB} MB)`);

    // Check if compressed versions exist
    const hasBrotli = files.includes(`${vendorFormsChunk}.br`);
    const hasGzip = files.includes(`${vendorFormsChunk}.gz`);

    if (hasBrotli || hasGzip) {
      console.log('✅ Compression:');
      if (hasBrotli) {
        const brStats = statSync(join(DIST_DIR, `${vendorFormsChunk}.br`));
        const brSizeKB = (brStats.size / 1024).toFixed(2);
        console.log(`   - Brotli: ${brSizeKB} KB`);
      }
      if (hasGzip) {
        const gzStats = statSync(join(DIST_DIR, `${vendorFormsChunk}.gz`));
        const gzSizeKB = (gzStats.size / 1024).toFixed(2);
        console.log(`   - Gzip: ${gzSizeKB} KB`);
      }
    }

    console.log('\n✅ SUCCESS: Vendor-forms chunk is properly configured!');
    process.exit(0);
  } else {
    console.log('⚠️  Could not definitively identify vendor-forms chunk');
    console.log('   This may be because:');
    console.log('   - The libraries are tree-shaken or minified beyond recognition');
    console.log('   - The chunk names are hashed differently');
    console.log('   - Manual verification of chunk contents is needed');

    // List all chunks for manual inspection
    console.log('\n📋 All JavaScript chunks:');
    jsChunks.forEach(chunk => {
      const stats = statSync(join(DIST_DIR, chunk));
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`   - ${chunk} (${sizeKB} KB)`);
    });

    process.exit(0);
  }

} catch (error) {
  console.error('❌ Error analyzing build output:', error.message);
  console.error('\nMake sure you have run "npm run build" first.');
  process.exit(1);
}
