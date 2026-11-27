import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tool.app',
  appName: 'Tool',
  webDir: 'dist',
  android: {
    // Strip '; wv)' so Google OAuth redirect works inside Capacitor Android WebView
    overrideUserAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  },
};

export default config;
