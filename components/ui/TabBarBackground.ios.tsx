import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';

export default function SolidTabBarBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.background]} />
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#0f0e0c',
    borderTopColor: '#2a2720',
    borderTopWidth: 1,
  },
});
