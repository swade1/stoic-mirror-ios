import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useKeepAwake } from 'expo-keep-awake';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';

type SlideshowTransition = 'fade' | 'slide';

const DEFAULT_DURATION_SECONDS = 7;
// Fade out, then fade in (or slide out, then slide in) — each phase gets
// this long, so the full transition is roughly double. Slower/more
// deliberate than a typical UI transition on purpose, to match a calmer,
// more contemplative feel.
const TRANSITION_PHASE_MS = 900;

export default function SlideshowPlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Keeps the screen awake for the life of this component — a slideshow
  // is meant to be watched hands-off, and the phone would otherwise
  // auto-lock mid-rotation.
  useKeepAwake();

  const [uris, setUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [transition, setTransition] = useState<SlideshowTransition>('fade');

  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);
  // Fill of the current slide's progress segment, 0 to 1.
  const progress = useSharedValue(0);
  // How much of the current slide's duration is left, in ms — the single
  // source of truth both the auto-advance timer and the visual progress
  // fill read from, so pausing freezes them in lockstep (the fill
  // visually promises exactly when the next slide will actually appear,
  // not an approximation) and resuming continues rather than restarting.
  const remainingMsRef = useRef(DEFAULT_DURATION_SECONDS * 1000);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) { setLoading(false); return; }

        const [{ data: photoRows, error }, { data: profileRow }] = await Promise.all([
          supabase
            .from('slideshow_photos')
            .select('asset_id')
            .eq('user_id', session.user.id)
            .order('sort_order', { ascending: true }),
          supabase
            .from('profiles')
            .select('slideshow_duration_seconds, slideshow_transition')
            .eq('id', session.user.id)
            .single(),
        ]);

        if (error || !photoRows || cancelled) { setLoading(false); return; }

        const resolvedDuration = profileRow?.slideshow_duration_seconds ?? DEFAULT_DURATION_SECONDS;
        const resolvedTransition: SlideshowTransition = profileRow?.slideshow_transition === 'slide' ? 'slide' : 'fade';

        const resolved = await Promise.all(
          photoRows.map(async (row) => {
            try {
              const info = await MediaLibrary.getAssetInfoAsync(row.asset_id);
              return info?.localUri ?? info?.uri ?? null;
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          setDurationSeconds(resolvedDuration);
          setTransition(resolvedTransition);
          setUris(resolved.filter((u): u is string => !!u));
          setCurrentIndex(0);
          setPaused(false);
          opacity.value = 1;
          translateX.value = 0;
          progress.value = 0;
          remainingMsRef.current = resolvedDuration * 1000;
          setLoading(false);
        }
      };

      load();
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Resets the countdown for whichever slide just became current —
  // called from the UI thread via runOnJS at the exact moment a
  // transition (auto or manual) finishes, so it's correct regardless of
  // what triggered the change.
  const resetCountdown = useCallback(() => {
    remainingMsRef.current = durationSeconds * 1000;
  }, [durationSeconds]);

  const goTo = useCallback((nextIndex: number, direction: 1 | -1) => {
    if (transition === 'slide') {
      translateX.value = withTiming(-direction * width, { duration: TRANSITION_PHASE_MS }, (finished) => {
        if (finished) {
          runOnJS(setCurrentIndex)(nextIndex);
          runOnJS(resetCountdown)();
          progress.value = 0;
          translateX.value = direction * width;
          translateX.value = withTiming(0, { duration: TRANSITION_PHASE_MS });
        }
      });
    } else {
      opacity.value = withTiming(0, { duration: TRANSITION_PHASE_MS }, (finished) => {
        if (finished) {
          runOnJS(setCurrentIndex)(nextIndex);
          runOnJS(resetCountdown)();
          progress.value = 0;
          opacity.value = withTiming(1, { duration: TRANSITION_PHASE_MS });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transition, width, resetCountdown]);

  const advance = useCallback((direction: 1 | -1) => {
    if (uris.length === 0) return;
    goTo((currentIndex + direction + uris.length) % uris.length, direction);
  }, [currentIndex, uris.length, goTo]);

  const togglePaused = useCallback(() => setPaused((p) => !p), []);

  // Drives both the auto-advance timer and the visual progress fill from
  // whatever time is actually left on this slide. On cleanup (pausing, a
  // slide change, or unmount) it banks however much time was actually
  // spent back into remainingMsRef, so a later resume picks up where it
  // left off instead of restarting the full duration.
  useEffect(() => {
    if (paused || uris.length <= 1) return;
    const startedAt = Date.now();
    const remaining = remainingMsRef.current;
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear });
    const timer = setTimeout(() => advance(1), remaining);
    return () => {
      clearTimeout(timer);
      cancelAnimation(progress);
      remainingMsRef.current = Math.max(0, remainingMsRef.current - (Date.now() - startedAt));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, paused, uris.length, durationSeconds, advance]);

  const handleShare = useCallback(async () => {
    setPaused(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) throw new Error('Sharing is not available on this device');
      await Sharing.shareAsync(uris[currentIndex], { mimeType: 'image/png', dialogTitle: 'Share Quote' });
    } catch (err) {
      Alert.alert('Share Failed', err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, [uris, currentIndex]);

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

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

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

        <View style={[styles.progressRow, { top: insets.top + 8 }]} pointerEvents="none">
          {uris.map((_, i) => (
            <View key={i} style={styles.progressSegment}>
              {i < currentIndex && <View style={styles.progressSegmentFilled} />}
              {i === currentIndex && <Animated.View style={[styles.progressSegmentFilled, progressFillStyle]} />}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.shareButton, { top: insets.top + 24 }]}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share this photo"
        >
          <IconSymbol name="paperplane.fill" size={16} color="#f0ead6" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 24 }]}
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
  progressRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressSegmentFilled: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: '#f0ead6',
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
  shareButton: {
    position: 'absolute',
    left: 16,
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
