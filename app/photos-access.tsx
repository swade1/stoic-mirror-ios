import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { IconSymbol } from '@/components/ui/IconSymbol';

// Shown once, right after the trial-started welcome. iOS only ever asks for
// Photos access once and always offers "Select Photos" alongside "Allow
// Access to All Photos" — and with limited access, photos a user adds to a
// slideshow can't be found again later. So this explains which to choose
// *before* the system dialog appears. If access has already been decided
// (granted or refused), the screen is skipped entirely.
export default function PhotosAccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);

  const goToApp = () => router.replace('/(tabs)');

  useEffect(() => {
    let cancelled = false;
    MediaLibrary.getPermissionsAsync()
      .then((p) => {
        if (cancelled) return;
        if (p.status !== 'undetermined') goToApp();
        else setReady(true);
      })
      .catch(() => { if (!cancelled) goToApp(); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = async () => {
    try {
      await MediaLibrary.requestPermissionsAsync(false);
    } finally {
      goToApp();
    }
  };

  if (!ready) return <View style={styles.container} />;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.body}>
        <IconSymbol name="photo.on.rectangle" size={44} color="#c9b97a" accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={styles.headline}>Your photos</Text>
        <Text style={styles.text}>
          Slideshows can use your own photos. When your iPhone asks, choose{' '}
          <Text style={styles.emphasis}>Allow Access to All Photos</Text> so every slide you add
          is always there.
        </Text>
        <Text style={styles.reassurance}>Your photos stay on your phone.</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleContinue} accessibilityRole="button">
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.skip} onPress={goToApp} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.skipText}>Not now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
    paddingHorizontal: 32,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  headline: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f0ead6',
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#a89f88',
    textAlign: 'center',
  },
  emphasis: {
    color: '#f0ead6',
    fontWeight: '700',
  },
  reassurance: {
    fontSize: 13,
    color: '#8a7e6e',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#c9b97a',
    borderRadius: 20,
    paddingVertical: 16,
    width: '100%',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f0e0c',
    textAlign: 'center',
    letterSpacing: 1,
  },
  skip: {
    alignSelf: 'center',
    marginTop: 16,
  },
  skipText: {
    fontSize: 14,
    color: '#8a7e6e',
  },
});
