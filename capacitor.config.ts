import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.newyorkminute.nyc',
  appName: 'New York Minute NYC',
  webDir: 'dist',
  server: {
    url: 'https://newyorkminutenyc.com',
    cleartext: true
  },
  plugins: {
    Geolocation: {
      enableBackgroundLocation: true
    }
  }
};

export default config;
