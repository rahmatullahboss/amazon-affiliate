import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dealsrky.agent',
  appName: 'Agent Portal',
  webDir: 'dist',
  server: {
    url: 'https://dealsrky.com/portal/products',
    cleartext: true
  }
};

export default config;
