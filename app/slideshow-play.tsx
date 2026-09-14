import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useKeepAwake } from 'expo-keep-awake';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';

const SLIDE_DURATION_MS = 7000;
const FADE_DURATION_MS = 300;

export default function SlideshowPlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Keeps the screen awake for the life of this component — a slideshow
  // is meant to be watched hands-off, and the phone would otherwise
  // auto-lock mid-rotation.
  useKeepAwake();

  const [uris, setUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const opacity = useSharedValue(1);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) { setLoading(false); return; }

        const { data, error } = await supabase
          .from('slideshow_photos')
          .select('asset_id')
          .eq('user_id', session.user.id)
          .order('sort_order', { ascending: true });

        if (error || !data || cancelled) { setLoading(false); return; }

        const resolved = await Promise.all(
          data.map(async (row) => {
            try {
              const info = await MediaLibrary.getAssetInfoAsync(row.asset_id);
              return info?.localUri ?? info?.uri ?? null;
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          setUris(resolved.filter((u): u is string => !!u));
          setCurrentIndex(0);
          opacity.value = 1;
          setLoading(false);
        }
      };

      load();
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const goTo = useCallback((nextIndex: number) => {
    opacity.value = withTiming(0, { duration: FADE_DURATION_MS }, (finished) => {
      if (finished) {
        runOnJS(setCurrentIndex)(nextIndex);
        opacity.value = withTiming(1, { duration: FADE_DURATION_MS });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = useCallback((direction: 1 | -1) => {
    if (uris.length === 0) return;
    goTo((currentIndex + direction + uris.length) % uris.length);
  }, [currentIndex, uris.length, goTo]);

  const togglePaused = useCallback(() => setPaused((p) => !p), []);

  // Auto-advance — recreated each time currentIndex/paused change, so a
  // manual swipe (which changes currentIndex) or a pause naturally resets
  // the wait for the next slide rather than firing early.
  useEffect(() => {
    if (paused || uris.length <= 1) return;
    const timer = setTimeout(() => advance(1), SLIDE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [currentIndex, paused, uris.length, advance]);

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(togglePaused)();
  });

  const pan = Gesture.Pan()
    // Requires real swipe motion so a plain tap-to-pause isn't claimed by
    // this gesture instead — same fix needed for the photo pan/double-tap
    // conflict in the quote card editor.
    .minDistance(20)
    .onEnd((e) => {
      if (e.translationX < -50) runOnJS(advance)(1);
      else if (e.translationX > 50) runOnJS(advance)(-1);
    });

  const gesture = Gesture.Race(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (loading) {
    return <View style={[styles.container, { paddingTop: insets.top }]} />;
  }

  if (uris.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, { paddingTop: insets.top }]}>
        <IconSymbol name="photo.on.rectangle" size={48} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={styles.emptyTitle}>No photos to play</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Slideshow"
        >
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <Image source={{ uri: uris[currentIndex] }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>

        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close slideshow"
          hitSlop={8}
        >
          <IconSymbol name="xmark" size={18} color="#f0ead6" />
        </TouchableOpacity>

        {paused && (
          <View style={styles.pausedBadge}>
            <IconSymbol name="pause.fill" size={14} color="#f0ead6" />
            <Text style={styles.pausedText}>Paused</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6a6050',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {
    fontSize: 14,
    color: '#c9b97a',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,14,12,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,14,12,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pausedText: {
    fontSize: 13,
    color: '#f0ead6',
    fontWeight: '600',
  },
});
