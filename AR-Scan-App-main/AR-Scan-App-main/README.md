# AR Scan

Marker-based web AR built on an Expo / React Native codebase.

* 📱 Opens the phone camera in the browser
* 🎯 Detects the **Hiro** AR marker with AR.js / ARToolKit
* 🟥 Places a red 3D cube on the marker
* 📐 The cube stays attached to the marker as the phone moves

<sub>Tracking runs on ARToolKit's WebAssembly build. The web target serves that page directly; the Android app ships the same page inside a WebView, so the APK works offline. See [Android APK](#android-apk).</sub>

## Quick start

```bash
npm install
npm run web
```

`http://localhost:8081` is a secure context, so the laptop webcam works straight away.

No camera nearby? Open `http://localhost:8081/?source=test` — the tracker runs against a bundled still frame of a Hiro marker instead of the webcam, which is handy for checking the pipeline and for debugging placement.

## Print the marker

The marker lives at [`public/data/hiro-marker.png`](public/data/hiro-marker.png), and the **Open marker** button in the app opens it too.

Print it (or show it on a second screen) at roughly 8–10 cm across, keep the white border around the black square intact, and avoid glossy paper — glare is the most common reason tracking drops.

## Running it on an Android phone

`getUserMedia` only works in a secure context, so `http://192.168.x.x:8081` will *not* get camera access. Pick one of these:

**1. Chrome port forwarding (no HTTPS needed)**

Enable USB debugging on the phone, plug it in, open `chrome://inspect/#devices` on the desktop, then *Port forwarding…* → map `8081` to `localhost:8081`. On the phone open `http://localhost:8081` — Chrome treats it as a secure origin.

**2. Tunnel the dev server**

```bash
npm run tunnel
```

Expo prints an `https://…` URL (installs `@expo/ngrok` the first time). Open it in Chrome on the phone.

**3. Deploy the static build**

```bash
npm run export:web     # writes ./dist
```

`dist/` is a plain static site — publish it anywhere that serves HTTPS (EAS Hosting, Netlify, Vercel, GitHub Pages).

## How it works

| File | Role |
| --- | --- |
| [`src/ar/session.ts`](src/ar/session.ts) | The whole AR pipeline: webcam source, ARToolKit context, Hiro marker controls, three.js scene and the render loop |
| [`src/ArView.web.tsx`](src/ArView.web.tsx) | Owns the session lifecycle and the loading / error states |
| [`src/ArView.tsx`](src/ArView.tsx) | Android shell: camera permission, then the bundled page in a WebView |
| [`scripts/bundle-web.mjs`](scripts/bundle-web.mjs) | Puts the web export inside the APK |
| [`src/ui/`](src/ui) | HUD and message card, plain React Native components |
| [`public/data/`](public/data) | Camera calibration, the Hiro pattern, the printable marker and the test frame |
| [`types/ar-threex.d.ts`](types/ar-threex.d.ts) | Typings for the AR.js three.js build, which ships none |

Each frame, ARToolKit scans the camera image for the Hiro pattern and returns a model-view matrix. That matrix is written into `markerRoot`; a second group follows it through `ArSmoothedControls` (lerped position and rotation) and carries the cube, which is why the cube stays put instead of jittering.

The camera's projection matrix comes from `public/data/camera_para.dat`, so 1 unit in the scene equals the width of the printed marker square. `CUBE_SIZE` in `src/ar/session.ts` is therefore a fraction of the marker.

### Notes

* `metro.config.js` pins every `three` import to the ESM build. AR.js `require`s three while the app imports it, and package exports would otherwise hand back two separate three.js instances.
* The webcam is requested in portrait on portrait screens (480×640) so AR.js does not have to blow up a landscape feed to cover the display.
* In development the scene objects are exposed on `window.__ar` for console poking.

## Android APK

```bash
npm run apk
```

The APK lands at `android/app/build/outputs/apk/release/app-release.apk`. Copy it to the phone and install it (Android will ask to allow installs from that source).

`npm run apk` runs three steps, which can also be run on their own:

1. `npm run prebuild:android` — generates the native `android/` project from `app.json`
2. `npm run bundle:web` — exports the web build and copies it to `android/app/src/main/assets/web`, rewriting Expo's absolute asset URLs to relative ones so they resolve under `file://`
3. `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` — assembles the APK

   The script also raises Gradle's HTTP timeouts to 10 minutes. React Native's `react-android` AAR is 160 MB and Gradle restarts a download from zero when a read times out, which is painful on a slow link.

   Only `arm64-v8a` is built: that covers every 64-bit Android phone and Apple Silicon emulators, and it keeps the native build from compiling four ABIs. Drop the flag (or list more) if you need 32-bit or Intel-emulator support.

Requires a JDK (17 or 21), the Android SDK, and several GB of free disk — the native build writes a few GB of intermediates before it links. If Gradle cannot find them:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=/path/to/android-sdk       # also written to android/local.properties
```

### How the APK runs AR

[`src/ArView.tsx`](src/ArView.tsx) asks for the Android camera permission, then loads `file:///android_asset/web/index.html` in a WebView. Chromium treats `file://` as a trustworthy origin, so `getUserMedia` is allowed once the app itself holds `CAMERA`; `allowFileAccessFromFileURLs` lets the page read the calibration and pattern files next to it. No network access is needed at runtime.

The release build is signed with the standard debug keystore that `expo prebuild` generates, which is fine for sideloading but not for the Play Store — generate your own keystore and point `signingConfigs.release` at it before publishing.

iOS is not wired up: it shows a notice pointing at the web build. Native marker tracking (ARKit/ARCore instead of ARToolKit) would be a different code path altogether.

## Scripts

| Script | Does |
| --- | --- |
| `npm run web` | Metro dev server for the browser |
| `npm run tunnel` | Same, exposed over HTTPS |
| `npm run export:web` | Static production build into `dist/` |
| `npm run apk` | Prebuild, bundle the web page and assemble a release APK |
| `npm run bundle:web` | Copy a fresh web export into the Android assets |
| `npm run android` / `npm run ios` | Native dev shells |
