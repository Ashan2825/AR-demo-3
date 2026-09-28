import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import ArView from './src/ArView';
import { theme } from './src/ui/theme';

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ArView />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
});
