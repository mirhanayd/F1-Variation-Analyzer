# PITWALL — Android APK Build Instructions

PITWALL is a React + Vite app wrapped with **Capacitor**. The Android project lives in
[`android/`](android/) and loads the built web app from `dist/`.

- **App name:** PITWALL
- **Package ID:** `com.pitwall.app`
- **Web assets:** `dist/` → copied to `android/app/src/main/assets/public` by `cap sync`

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 or newer |
| Android Studio | Ladybug or newer (bundles JDK 21) |
| Android SDK | Platform 35/36 + build tools (installed via Android Studio) |

You do **not** need a separate JDK if Android Studio is installed — its bundled
JBR (JDK 21) is enough. For command-line builds set `JAVA_HOME` to it, e.g. on Windows:
`C:\Program Files\Android\Android Studio\jbr`.

## 1. Install dependencies

```bash
cd f1-apex-sim
npm install
```

## 2. Build the web app

```bash
npm run build
```

This produces `dist/`.

## 3. Sync Capacitor

```bash
npx cap sync android
```

Or do steps 2 + 3 in one go:

```bash
npm run android:sync
```

Run this again **every time you change web code**, otherwise the APK ships stale assets.

## 4. Open in Android Studio

```bash
npm run android:open
```

(equivalent to `npx cap open android`). Let Gradle finish syncing on first open.

## 5. Generate a debug APK

**In Android Studio:** menu **Build → Build App Bundle(s) / APK(s) → Build APK(s)**,
then click "locate" in the notification.

**Or from the command line:**

```bash
npm run android:apk
```

(equivalent to `cd android && gradlew assembleDebug` after a sync).

## 6. Where the APK is

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Copy it to a phone and install (enable "Install unknown apps" for your file manager),
or install directly over USB with `adb install -r app-debug.apk`.

## Useful npm scripts

| Script | What it does |
|---|---|
| `npm run android:sync` | Build web app + copy into the Android project |
| `npm run android:open` | Open the Android project in Android Studio |
| `npm run android:run` | Sync, then build & deploy to a connected device/emulator |
| `npm run android:apk` | Sync, then build the debug APK via Gradle |
| `npm run android:assets` | Regenerate launcher icons + splash screens from `assets/` |

## Icons & splash screens

Placeholder brand assets live in [`assets/`](assets/) (`icon-only.png`,
`icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png`).
To replace them, drop in new PNGs with the same names (icons 1024×1024,
splash 2732×2732) and run `npm run android:assets`, then `npx cap sync android`.

## Troubleshooting

- **"SDK location not found"** — create `android/local.properties` containing
  `sdk.dir=C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk` (Android Studio creates
  this automatically on first open).
- **"Unsupported class file major version" / wrong Java version** — Gradle is using
  an old JDK. Set `JAVA_HOME` to Android Studio's JBR (JDK 21) or set
  **File → Settings → Build Tools → Gradle → Gradle JDK** to the embedded JDK.
- **Gradle sync fails on first open** — usually a network hiccup while downloading
  Gradle/dependencies. Check your connection and press **Sync Project with Gradle
  Files** again.
- **"licenses have not been accepted"** — run
  `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\sdkmanager --licenses` and accept.
- **APK shows an old version of the app** — you forgot `npm run android:sync`
  after changing web code.
- **Blank screen on device** — the app needs internet for F1 data; also check
  `chrome://inspect` on a USB-connected device to see WebView console errors.
- **Anything else Gradle-related** — in Android Studio use
  **Build → Clean Project**, then **File → Invalidate Caches / Restart**, and rebuild.
