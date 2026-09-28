import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

type Props = {
  markerVisible: boolean;
  fps: number;
  spin: boolean;
  onToggleSpin: () => void;
  testMode?: boolean;
};

/** Overlay drawn on top of the camera + WebGL layers. */
export function Hud({ markerVisible, fps, spin, onToggleSpin, testMode }: Props) {
  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.pill}>
          <View style={[styles.dot, markerVisible ? styles.dotOn : styles.dotOff]} />
          <Text style={styles.pillText}>
            {markerVisible ? 'Tracking Hiro marker' : 'Searching for Hiro marker'}
          </Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillMuted}>
            {testMode ? 'test scene' : 'live camera'}
            {fps > 0 ? ` · ${fps} fps` : ''}
          </Text>
        </View>
      </View>

      {!markerVisible && (
        <View style={styles.center} pointerEvents="none">
          <View style={styles.reticle} />
          <Text style={styles.hint}>
            {testMode ? 'Looking for the marker in the test scene' : 'Point the camera at the Hiro marker'}
          </Text>
          <Text style={styles.hintMuted}>Fill about a third of the frame and hold steady</Text>
        </View>
      )}

      <View style={styles.bottomBar} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onToggleSpin}
        >
          <Text style={styles.buttonText}>{spin ? 'Stop spin' : 'Spin cube'}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => Linking.openURL('data/hiro-marker.png')}
        >
          <Text style={styles.buttonText}>Open marker</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillText: { color: theme.text, fontSize: 13, fontWeight: '600' },
  pillMuted: { color: theme.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: theme.ok },
  dotOff: { backgroundColor: theme.accent },
  center: { alignItems: 'center', gap: 14 },
  reticle: {
    width: 190,
    height: 190,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderStyle: 'dashed',
  },
  hint: { color: theme.text, fontSize: 16, fontWeight: '600' },
  hintMuted: { color: theme.muted, fontSize: 13, marginTop: -8 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: theme.radius,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: theme.text, fontSize: 14, fontWeight: '600' },
});
