import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.premium.delivery',
  appName: 'Premium Delivery',
  webDir: 'dist',
  server: {
    url: 'https://localhost',
    cleartext: true
  },
  plugins: {
    Geolocation: {
      enableBackgroundLocation: true
    }
  }
};

export default config;
