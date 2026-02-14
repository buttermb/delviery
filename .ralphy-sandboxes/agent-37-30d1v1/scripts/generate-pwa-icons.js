#!/usr/bin/env node
/**
 * PWA Icon Generator Script
 * 
 * Generates all required PWA icons from a source SVG or PNG.
 * 
 * Usage: 
 *   node scripts/generate-pwa-icons.js [source-image]
 * 
 * Requirements:
 *   npm install sharp
 * 
 * If no source provided, uses placeholder.svg
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Icon sizes needed for PWA
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

// Source image (default to placeholder)
const SOURCE_IMAGE = process.argv[2] || path.join(__dirname, '../public/placeholder.svg');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateIcons() {
  console.log(`Generating PWA icons from: ${SOURCE_IMAGE}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  
  try {
    // Generate standard icons
    for (const size of ICON_SIZES) {
      const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
      
      await sharp(SOURCE_IMAGE)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 15, g: 20, b: 25, alpha: 1 } // #0f1419
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated: icon-${size}x${size}.png`);
    }
    
    // Generate maskable icon (with safe zone padding)
    const maskableSize = 512;
    const padding = Math.floor(maskableSize * 0.1); // 10% safe zone
    const innerSize = maskableSize - (padding * 2);
    
    const maskablePath = path.join(OUTPUT_DIR, `maskable-icon-${maskableSize}x${maskableSize}.png`);
    
    // Create canvas with background
    await sharp({
      create: {
        width: maskableSize,
        height: maskableSize,
        channels: 4,
        background: { r: 45, g: 212, b: 191, alpha: 1 } // #2dd4bf (theme color)
      }
    })
    .composite([{
      input: await sharp(SOURCE_IMAGE)
        .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer(),
      gravity: 'center'
    }])
    .png()
    .toFile(maskablePath);
    
    console.log(`✓ Generated: maskable-icon-${maskableSize}x${maskableSize}.png`);
    
    // Generate shortcut icons
    const shortcuts = ['dashboard', 'orders', 'inventory', 'pos'];
    for (const shortcut of shortcuts) {
      const shortcutPath = path.join(OUTPUT_DIR, `shortcut-${shortcut}.png`);
      
      await sharp(SOURCE_IMAGE)
        .resize(96, 96, {
          fit: 'contain',
          background: { r: 15, g: 20, b: 25, alpha: 1 }
        })
        .png()
        .toFile(shortcutPath);
      
      console.log(`✓ Generated: shortcut-${shortcut}.png`);
    }
    
    // Generate Apple touch icons
    const appleSizes = [180, 167, 152, 120];
    for (const size of appleSizes) {
      const applePath = path.join(OUTPUT_DIR, `apple-touch-icon-${size}x${size}.png`);
      
      await sharp(SOURCE_IMAGE)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 15, g: 20, b: 25, alpha: 1 }
        })
        .png()
        .toFile(applePath);
      
      console.log(`✓ Generated: apple-touch-icon-${size}x${size}.png`);
    }
    
    // Generate default apple-touch-icon.png
    await sharp(SOURCE_IMAGE)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 15, g: 20, b: 25, alpha: 1 }
      })
      .png()
      .toFile(path.join(OUTPUT_DIR, 'apple-touch-icon.png'));
    
    console.log(`✓ Generated: apple-touch-icon.png`);
    
    console.log('\\n✅ All PWA icons generated successfully!');
    console.log('\\nNext steps:');
    console.log('1. Replace the source image with your actual logo');
    console.log('2. Re-run this script: node scripts/generate-pwa-icons.js path/to/logo.svg');
    console.log('3. Verify icons look correct in /public/icons/');
    
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

// Check if sharp is installed
try {
  require.resolve('sharp');
  generateIcons();
} catch {
  console.log('\\n⚠️  sharp package not installed.');
  console.log('\\nTo generate icons, run:');
  console.log('  npm install sharp --save-dev');
  console.log('  node scripts/generate-pwa-icons.js');
  console.log('\\nFor now, creating placeholder icons directory...');
  
  // Create a README in the icons folder
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'README.md'),
    `# PWA Icons

This directory should contain PWA app icons.

## Generate Icons

1. Install sharp: \`npm install sharp --save-dev\`
2. Run: \`node scripts/generate-pwa-icons.js path/to/your-logo.svg\`

## Required Sizes

- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512 (standard)
- 512x512 maskable (with safe zone)
- 180x180 (Apple touch icon)

## Manual Creation

If you prefer to create icons manually:
1. Export your logo to each size
2. Save as PNG in this directory
3. Name format: \`icon-{size}x{size}.png\`
`
  );
  
  console.log('✓ Created icons directory with README');
}

