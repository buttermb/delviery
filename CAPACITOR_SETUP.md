# Capacitor Mobile App Setup

This project is now configured with Capacitor for native iOS and Android deployment with full background location tracking and native features.

## 🚀 Features Implemented

### Web-Compatible Features (Working Now)
- ✅ PIN authentication with 4-6 digit security code
- ✅ Session management with 5-minute auto-lock
- ✅ Location permission blocking (cannot proceed without granting)
- ✅ Improved courier dashboard UI
- ✅ Enhanced order acceptance flow
- ✅ Better status toggle system
- ✅ Real-time location tracking (when app is open)

### Native Features (Requires Mobile App)
- 🔄 Background location tracking (even when app is minimized)
- 🔄 "Always Allow" location permissions
- 🔄 Native biometric unlock (Face ID / Touch ID)
- 🔄 Push notifications for new orders
- 🔄 Battery-optimized GPS tracking
- 🔄 Offline location caching

## 📱 Setting Up for Mobile Deployment

### Prerequisites
- Node.js and npm installed
- For iOS: macOS with Xcode
- For Android: Android Studio

### Initial Setup

1. **Clone your project from GitHub**
   ```bash
   git clone [your-repo-url]
   cd bud-dash-nyc
   npm install
   ```

2. **Initialize Capacitor** (Already configured!)
   ```bash
   npx cap init
   ```
   The config is already set with:
   - App ID: `com.newyorkminute.nyc`
   - App Name: `New York Minute NYC`

3. **Add iOS and/or Android platforms**
   ```bash
   npx cap add ios
   npx cap add android
   ```

4. **Update native dependencies**
   ```bash
   npx cap update ios
   # or
   npx cap update android
   ```

5. **Build your web assets**
   ```bash
   npm run build
   ```

6. **Sync to native platforms**
   ```bash
   npx cap sync
   ```

### Running on Device/Emulator

**For iOS:**
```bash
npx cap run ios
```

**For Android:**
```bash
npx cap run android
```

### Required Native Permissions

The app requires the following permissions which need to be configured in native projects:

**iOS (Info.plist):**
```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>BudDash needs your location to track deliveries and show customers accurate ETAs, even when the app is in the background.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>BudDash needs your location to track deliveries and show customers accurate ETAs.</string>

<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

**Android (AndroidManifest.xml):**
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

## 🔒 Security Features

### PIN Authentication
- First-time users must set a 4-6 digit PIN
- PIN required on every app launch
- Auto-lock after 5 minutes of inactivity
- PIN stored securely (hashed) in database

### Location Security
- Users cannot access courier features without location permission
- Blocking modal prevents progression until permission granted
- Real-time location updates sent to backend
- Location history logged for compliance

## 🎯 Courier Flow

1. **Login** → Email/password authentication
2. **PIN Setup** → Set security PIN (first time only)
3. **PIN Entry** → Enter PIN to unlock app
4. **Location Permission** → Grant "Always Allow" location access
5. **Dashboard** → Access courier features

## 🔄 Hot Reload During Development

The app is configured for hot-reload from the production server:
```
https://newyorkminutenyc.com
```

This allows you to develop and test changes without rebuilding the native app.

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Geolocation Plugin Docs](https://capacitorjs.com/docs/apis/geolocation)

## 🆘 Troubleshooting

### Location not updating
1. Check device location services are enabled
2. Verify app has "Always Allow" permission
3. Restart the app
4. Check GPS signal strength

### PIN not working
1. Ensure database migration completed
2. Check courier record exists
3. Try resetting PIN (contact admin)

### App not building
1. Clean build: `npx cap sync --clean`
2. Update dependencies: `npm install`
3. Rebuild: `npm run build && npx cap sync`

## 🚀 Deployment Checklist

- [ ] Test PIN authentication flow
- [ ] Verify location permission blocking
- [ ] Test background location tracking
- [ ] Configure push notification credentials
- [ ] Test on real devices (not just emulators)
- [ ] Submit to App Store / Play Store
- [ ] Configure production API endpoints
