import { Capacitor } from '@capacitor/core';

// Native-shell wiring for the Android (Capacitor) build. No-ops on the web.
export const initNativeShell = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch (error) {
    console.warn('Capacitor App plugin unavailable', error);
  }

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#05070b' });
  } catch (error) {
    console.warn('Capacitor StatusBar plugin unavailable', error);
  }
};
