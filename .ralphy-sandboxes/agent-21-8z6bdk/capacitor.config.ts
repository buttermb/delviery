import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.floraiq.app',
  appName: 'FloraIQ',
  webDir: 'dist',
  // server: {
  //   url: 'https://localhost',
  //   cleartext: true
  // },
  plugins: {
    Geolocation: {
      enableBackgroundLocation: true
    }
  }
};

export default config;
