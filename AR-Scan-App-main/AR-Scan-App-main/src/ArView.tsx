import { useCallback, useEffect, useState } from 'react';
import { PermissionsAndroid, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Message } from './ui/Message';
import { theme } from './ui/theme';

/**
 * Native shell.
 *
 * ARToolKit only exists as a WebAssembly build, so the packaged app runs the
 * exact same AR page as the web target inside a WebView. The static export is
 * copied into the APK's assets by `scripts/bundle-web.mjs`, which is why this
 * works with no network connection.
 *
 * `file://` counts as a trustworthy origin in Chromium, so `getUserMedia` is
 * allowed there once the app itself holds the CAMERA permission.
 */
const BUNDLED_APP_URL = 'file:///android_asset/web/index.html';

type PermissionState = 'pending' | 'granted' | 'denied';

export default function ArView() {
  const [permission, setPermission] = useState<PermissionState>('pending');
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;

    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Camera access',
      message: 'AR Scan needs the camera to find the Hiro marker.',
      buttonPositive: 'Allow',
    })
      .then((result) => {
        if (cancelled) return;
        setPermission(result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
      })
      .catch(() => !cancelled && setPermission('denied'));

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoadError(null);
    setPermission('pending');
    setAttempt((n) => n + 1);
  }, []);

  if (Platform.OS !== 'android') {
    return (
      <View style={styles.root}>
        <Message
          title="Android and web only"
          body={'This build packages the AR page for Android. On other platforms run "npm run web" and open the page in a browser.'}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {permission === 'granted' && !loadError && (
        <WebView
          source={{ uri: BUNDLED_APP_URL }}
          style={styles.webview}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          // The AR page loads its calibration and pattern files over XHR from
          // the same file:// directory, which needs these two explicitly.
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          allowsInlineMediaPlayback
          onError={({ nativeEvent }) =>
            setLoadError(nativeEvent.description || 'The bundled AR page failed to load.')
          }
        />
      )}

      {permission === 'pending' && (
        <Message title="Starting AR Scan" body="Waiting for the camera permission." />
      )}

      {permission === 'denied' && (
        <Message
          title="Camera permission needed"
          body="AR Scan cannot find the marker without the camera. Grant camera access in Settings, then try again."
          actionLabel="Try again"
          onAction={retry}
        />
      )}

      {loadError && (
        <Message
          title="AR page missing"
          body={`${loadError} Rebuild the APK with "npm run apk" so the web export is bundled into the app.`}
          actionLabel="Try again"
          onAction={retry}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  webview: { flex: 1, backgroundColor: theme.bg },
});
