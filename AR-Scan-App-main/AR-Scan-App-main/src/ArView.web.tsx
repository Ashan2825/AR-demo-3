import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArSession, type ArSourceKind, type ArState } from './ar/session';
import { Hud } from './ui/Hud';
import { Message } from './ui/Message';
import { theme } from './ui/theme';

const INITIAL: ArState = { phase: 'starting', markerVisible: false, fps: 0 };

/** `?source=test` swaps the webcam for a bundled still frame of a Hiro marker. */
function requestedSource(): ArSourceKind {
  if (typeof window === 'undefined') return 'webcam';
  return new URLSearchParams(window.location.search).get('source') === 'test'
    ? 'test'
    : 'webcam';
}

export default function ArView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<ArSession | null>(null);
  const [state, setState] = useState<ArState>(INITIAL);
  const [spin, setSpin] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const source = requestedSource();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    setState(INITIAL);
    const session = new ArSession(setState);
    session.options.spin = spin;
    session.options.source = source;
    sessionRef.current = session;
    // Failures are reported through the state callback; the rejection here is
    // only used to stop the start sequence.
    session.start(element).catch(() => {});

    return () => {
      session.stop();
      sessionRef.current = null;
    };
    // `spin` is applied imperatively, so it must not restart the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, source]);

  const toggleSpin = useCallback(() => {
    setSpin((previous) => {
      const next = !previous;
      sessionRef.current?.setSpin(next);
      return next;
    });
  }, []);

  return (
    <View style={styles.root}>
      <div ref={containerRef} style={containerStyle} />

      {state.phase === 'running' && (
        <Hud
          markerVisible={state.markerVisible}
          fps={state.fps}
          spin={spin}
          onToggleSpin={toggleSpin}
          testMode={source === 'test'}
        />
      )}

      {state.phase === 'starting' && (
        <Message
          title={source === 'test' ? 'Loading the test scene' : 'Starting the camera'}
          body={
            source === 'test'
              ? 'Replaying a still frame that contains a Hiro marker, so tracking can be checked without a camera.'
              : 'Allow camera access when the browser asks. On Android use Chrome, and make sure the page is served over HTTPS or localhost.'
          }
        />
      )}

      {state.phase === 'error' && (
        <Message
          title="Camera unavailable"
          body={state.error ?? 'The camera could not be started.'}
          actionLabel="Try again"
          onAction={() => setAttempt((n) => n + 1)}
        />
      )}
    </View>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  background: theme.bg,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
});
