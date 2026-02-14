# Mobile Deployment Guide (Capacitor)

## Overview
This guide covers the steps to build and deploy FloraIQ to Android and iOS devices using Capacitor.

## Prerequisites
- **Node.js** (v18+)
- **Android Studio** (for Android builds) with SDK installed
- **Xcode** (for iOS builds) with valid developer certificate (macOS only)
- **CocoaPods** (for iOS dependencies)

## Configuration Files
### General
- `capacitor.config.ts`: Main configuration (App ID, Web Dir).

### Android
- `android/app/src/main/AndroidManifest.xml`: Permissions (Camera, Location, etc).
- `android/variables.gradle`: Version settings.

### iOS
- `ios/App/App/Info.plist`: Privacy descriptions (Camera Usage, Location Usage, etc).

## Build Process

### 1. Build Web Assets
First, build the React/Vite application. This generates the `dist` folder.
```bash
npm run build
```

### 2. Sync Native Projects
Copy the web assets and update native plugins.
```bash
npx cap sync
```

### 3. Build/Run on Device

#### Android
Open the project in Android Studio:
```bash
npx cap open android
```
- Wait for Gradle sync to complete.
- Select your connected device or emulator.
- Click **Run** (Green Play Button).

#### iOS
Open the project in Xcode:
```bash
npx cap open ios
```
- Wait for CocoaPods indexing.
- Select your Team in **Scanning > Signing & Capabilities**.
- Select your connected device or simulator.
- Click **Run** (Play Button).

## Feature Configuration

### Permissions
Ensure these permissions are configured if handling Camera or Location features:

**Android (`AndroidManifest.xml`)**:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

**iOS (`Info.plist`)**:
```xml
<key>NSCameraUsageDescription</key>
<string>We need access to camera to scan products.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location for delivery tracking.</string>
```

### App Icons & Splash Screens
To generate assets, install `@capacitor/assets` (optional):
```bash
npm install @capacitor/assets --save-dev
npx capacitor-assets generate
```

### Push Notifications

#### Firebase Cloud Messaging (Android)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Add an Android app with package name `com.floraiq.app`
4. Download `google-services.json`
5. Place it in `android/app/google-services.json`
6. Get the Server Key from Project Settings > Cloud Messaging
7. Add `FCM_SERVER_KEY` to Supabase Edge Function secrets:
   ```bash
   supabase secrets set FCM_SERVER_KEY=your_server_key
   ```

#### Apple Push Notifications (iOS)
1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create an APNs Key (or certificate)
3. Download `GoogleService-Info.plist` from Firebase
4. Place it in `ios/App/App/GoogleService-Info.plist`
5. Enable Push Notifications in Xcode:
   - Select Target "App" > Signing & Capabilities
   - Click "+ Capability" > Push Notifications

#### Testing Push Notifications
The app automatically:
1. Requests notification permissions on startup
2. Registers FCM token with the backend
3. Listens for foreground/background notifications

Order status updates trigger automatic push notifications to customers.

## Troubleshooting

### "Web View Not Loading"
- Ensure `webDir` in `capacitor.config.ts` matches `dist`.
- Ensure you ran `npm run build` before `npx cap sync`.

### "Cleartext Traffic Not Permitted" (Android)
- If taking to non-HTTPS APIs, add `android:usesCleartextTraffic="true"` to `<application>` in Manifest (Not recommended for production).

### "Signing Error" (iOS)
- Open Xcode -> Select Target "App" -> Signing & Capabilities.
- Ensure a valid Team is selected.
