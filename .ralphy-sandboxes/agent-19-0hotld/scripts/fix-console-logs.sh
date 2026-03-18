#!/bin/bash
# Replace console.log, console.error, console.warn with logger equivalents

# Find all TS/TSX files in src
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/console\.log(/logger.debug(/g' \
  -e 's/console\.error(/logger.error(/g' \
  -e 's/console\.warn(/logger.warn(/g' \
  -e 's/console\.info(/logger.info(/g' \
  {} \;

echo "Console.log replacement complete."
