import { Plugin } from 'vite';
import { writeFileSync } from 'fs';
import { join } from 'path';

export function versionGeneratorPlugin(): Plugin {
  return {
    name: 'version-generator',
    buildStart() {
      // Generate version.json with current build time
      const buildTime = new Date().toISOString();
      const versionData = {
        buildTime,
        version: process.env.npm_package_version || '1.0.0'
      };

      const publicPath = join(process.cwd(), 'public', 'version.json');
      writeFileSync(publicPath, JSON.stringify(versionData, null, 2));

      console.log('✅ Generated version.json with build time:', buildTime);
    }
  };
}
