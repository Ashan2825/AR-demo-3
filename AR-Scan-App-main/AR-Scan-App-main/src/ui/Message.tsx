import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Full-screen card used for the loading, error and unsupported-platform states. */
export function Message({ title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {actionLabel && onAction && (
          <Pressable
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
            onPress={onAction}
          >
            <Text style={styles.buttonText}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.bg,
    zIndex: 20,
  },
  card: {
    maxWidth: 420,
    width: '100%',
    gap: 12,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
  },
  title: { color: theme.text, fontSize: 19, fontWeight: '700' },
  body: { color: theme.muted, fontSize: 14, lineHeight: 21 },
  button: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: theme.accent,
    borderRadius: theme.radius,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
