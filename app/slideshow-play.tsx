import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
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
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { IconButton } from '@/components/ui/IconButton';
import { listAmbientTracks, type AmbientTrack } from '@/lib/ambientTracks';
import { resolvePersonalAmbientTrackUri } from '@/lib/personalAmbientTrack';
import { listPlaylistItems, type PlaylistItem } from '@/lib/ambientPlaylist';
import { resolveSlideshowAssetUri } from '@/lib/slideshowAssets';

type SlideshowTransition = 'fade' | 'slide';
type AmbientVolume = 'low' | 'medium' | 'high';

const DEFAULT_DURATION_SECONDS = 7;
// Fade out, then fade in (or slide out, then slide in) — each phase gets
// this long, so the full transition is roughly double. Slower/more
// deliberate than a typical UI transition on purpose, to match a calmer,
// more contemplative feel. Also reused as the ambient-music fade-out
// duration on exit, for the same unhurried pacing.
const TRANSITION_PHASE_MS = 900;
// Kept deliberately subdued at every level — this is background
// ambience, never meant to compete with the visual/text experience.
const VOLUME_GAIN: Record<AmbientVolume, number> = { low: 0.15, medium: 0.35, high: 0.6 };
const SLEEP_TIMER_OPTIONS_MIN = [5, 10, 15, 30];
// How long the controls (progress bar, share/timer/close icons) stay
// visible after the last interaction before fading out — long enough not
// to feel twitchy, matching the app's generally unhurried pacing, but
// short enough that they're out of the way of the image/text most of the
// time a slide is just sitting there being read.
const CONTROLS_IDLE_MS = 4000;
const CONTROLS_FADE_MS = 500;

export default function SlideshowPlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const { width } = useWindowDimensions();
  // Keeps the screen awake for the life of this component — a slideshow
  // is meant to be watched hands-off, and the phone would otherwise
  // auto-lock mid-rotation.
  useKeepAwake();

  // Without this, the ambient soundtrack stops within moments of the
  // screen locking or the app backgrounding — iOS suspends the app since
  // nothing has told it this is a media-playback session (paired with
  // the UIBackgroundModes "audio" entry in app.json, which is the other
  // half of that same requirement). playsInSilentMode is set alongside
  // it for the same reason: someone who locked the phone to just listen
  // likely also has the hardware mute switch on.
  useEffect(() => {
    setAudioModeAsync({ shouldPlayInBackground: true, playsInSilentMode: true }).catch(() => {});
  }, []);

  const [uris, setUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [transition, setTransition] = useState<SlideshowTransition>('fade');
  // The resolved, playable queue for this collection's ambient playlist,
  // and which item within it is currently playing. Replaces a single
  // track + player.loop=true — looping the whole queue (see the
  // didJustFinish listener below) subsumes looping a single file for
  // free, since a one-item queue just re-selects its own only index.
  const [ambientQueue, setAmbientQueue] = useState<string[]>([]);
  const [ambientQueueIndex, setAmbientQueueIndex] = useState(0);
  const [ambientVolume, setAmbientVolume] = useState<AmbientVolume>('medium');
  // Session-only — never persisted, always starts back at Off. "How long
  // do I want to watch right now" is a fresh choice each sitting, not a
  // trait of the collection the way duration/transition/music are.
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepRemainingLabel, setSleepRemainingLabel] = useState<string | null>(null);
  const [showSleepPanel, setShowSleepPanel] = useState(false);
  // Whether the progress bar / share / timer / close controls are showing.
  // Defaults visible so the affordances are obvious the moment the screen
  // opens, then fades out after CONTROLS_IDLE_MS of no interaction so they
  // stop sitting on top of any text near the top of the image.
  const [controlsVisible, setControlsVisible] = useState(true);
  // Two fixed Image slots used only for the 'slide' transition, swapped
  // back and forth rather than having one Image's source track
  // currentIndex directly. A slot's uri is only ever changed while it's
  // off-screen (see goTo) — never while it's the visible one — so there's
  // no moment where a slot's position and its photo can disagree. An
  // earlier version kept a single "base" layer whose source followed
  // currentIndex and reset its position at the same time; that requires a
  // React state update (the source swap) and a Reanimated shared-value
  // write (the position reset) to land in the same frame, and they don't
  // — the shared value reaches the UI thread first, so the base layer
  // would briefly sit at rest still showing the outgoing photo, i.e. the
  // previous slide flashing back.
  const [slotUris, setSlotUris] = useState<[string | null, string | null]>([null, null]);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);

  const player = useAudioPlayer(null);

  const opacity = useSharedValue(1);
  const controlsOpacity = useSharedValue(1);
  const slotTranslateX0 = useSharedValue(0);
  const slotTranslateX1 = useSharedValue(0);
  // Fill of the current slide's progress segment, 0 to 1.
  const progress = useSharedValue(0);
  // How much of the current slide's duration is left, in ms — the single
  // source of truth both the auto-advance timer and the visual progress
  // fill read from, so pausing freezes them in lockstep (the fill
  // visually promises exactly when the next slide will actually appear,
  // not an approximation) and resuming continues rather than restarting.
  // Written in exactly two places: advanceToIndex resets it to a full
  // duration on every slide change, and the pause-banking effect below
  // decrements it. Nothing else may touch it — see that effect's comment
  // for why an earlier version that also decremented it from the timer
  // effect's cleanup corrupted every other slide's duration.
  const remainingMsRef = useRef(DEFAULT_DURATION_SECONDS * 1000);
  // When the current timer/animation run actually started, so the
  // pause-banking effect can compute how much of it was really spent.
  const startedAtRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // TEMP DEBUG — remove once the stuck-pause bug is diagnosed.
      console.log(`[SLIDESHOW] focus effect mounted/refocused, collectionId=${collectionId}`);

      const load = async () => {
        if (!collectionId) { setLoading(false); return; }
        setLoading(true);
        // TEMP DEBUG
        console.log('[SLIDESHOW] load() starting');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) { setLoading(false); return; }

        const [{ data: photoRows, error }, { data: collectionRow }, ambientTracks] = await Promise.all([
          supabase
            .from('slideshow_photos')
            .select('asset_id')
            .eq('user_id', session.user.id)
            .eq('collection_id', collectionId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('slideshow_collections')
            .select('slideshow_duration_seconds, slideshow_transition, ambient_volume, soundtrack_id')
            .eq('id', collectionId)
            .single(),
          listAmbientTracks().catch(() => [] as AmbientTrack[]),
        ]);

        if (error || !photoRows || cancelled) { setLoading(false); return; }

        // Only a slideshow with a soundtrack assigned has anything to
        // queue — see app/soundtracks.tsx for how that assignment is made.
        const playlistItems = collectionRow?.soundtrack_id
          ? await listPlaylistItems(collectionRow.soundtrack_id).catch(() => [] as PlaylistItem[])
          : [];

        const resolvedDuration = collectionRow?.slideshow_duration_seconds ?? DEFAULT_DURATION_SECONDS;
        const resolvedTransition: SlideshowTransition = collectionRow?.slideshow_transition === 'slide' ? 'slide' : 'fade';
        // Each item resolves independently and a failure just drops it —
        // a stale curated reference (removed from the bucket) or a
        // missing personal file (local storage cleared) isn't user data
        // worth erroring over, the same tolerant treatment a deleted
        // Photos asset already gets elsewhere in this app. The queue
        // itself, not any single file, is what loops — see the ambient
        // playback effect below.
        const resolvedQueue = playlistItems
          .map((item) =>
            item.sourceType === 'curated'
              ? ambientTracks.find((t) => t.id === item.curatedTrackId)?.url ?? null
              : resolvePersonalAmbientTrackUri(item.id, item.personalFileName ?? '')
          )
          .filter((url): url is string => !!url);
        const resolvedVolume: AmbientVolume =
          collectionRow?.ambient_volume === 'low' || collectionRow?.ambient_volume === 'high'
            ? collectionRow.ambient_volume
            : 'medium';

        const resolved = await Promise.all(photoRows.map((row) => resolveSlideshowAssetUri(row.asset_id)));

        // TEMP DEBUG
        console.log(`[SLIDESHOW] load() reached commit point, cancelled=${cancelled}`);
        if (!cancelled) {
          setDurationSeconds(resolvedDuration);
          setTransition(resolvedTransition);
          setAmbientQueue(resolvedQueue);
          setAmbientQueueIndex(0);
          setAmbientVolume(resolvedVolume);
          setSleepMinutes(null);
          const validUris = resolved.filter((u): u is string => !!u);
          setUris(validUris);
          setCurrentIndex(0);
          setSlotUris([validUris[0] ?? null, null]);
          setActiveSlot(0);
          setPaused(false);
          // TEMP DEBUG
          console.log('[SLIDESHOW] load() committed, setPaused(false) called');
          transitioningRef.current = false;
          opacity.value = 1;
          slotTranslateX0.value = 0;
          slotTranslateX1.value = 0;
          progress.value = 0;
          remainingMsRef.current = resolvedDuration * 1000;
          setLoading(false);
        }
      };

      load();
      return () => {
        cancelled = true;
        // TEMP DEBUG
        console.log('[SLIDESHOW] focus effect cleanup — losing focus/unmounting');
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionId])
  );

  // Warms expo-image's cache for the whole collection up front. Without
  // this, swapping the single Image element's source.uri mid-transition
  // can briefly show a blank frame while the new photo decodes — which
  // reads as a black slide, since the container behind it is near-black.
  // Collections here are curated card sets (small), so prefetching all of
  // them at once is cheap and means no slide is ever decoding on demand.
  useEffect(() => {
    if (uris.length === 0) return;
    Image.prefetch(uris).catch(() => {});
  }, [uris]);

  // Advances to a new slide and resets its countdown in one JS-thread
  // call, not two separate runOnJS calls — setCurrentIndex can trigger
  // React's re-render (and the timer effect's cleanup, which reads
  // remainingMsRef) before a *second*, independently-scheduled runOnJS
  // call actually runs, so a standalone "reset the ref" call raced the
  // state update: every other slide, the cleanup read the ref before it
  // had been reset, computed a negative remaining time, clamped to 0,
  // and the next slide's timer fired almost instantly. Doing both in one
  // synchronous call makes the ordering safe by construction.
  const advanceToIndex = useCallback((nextIndex: number) => {
    remainingMsRef.current = durationSeconds * 1000;
    setCurrentIndex(nextIndex);
  }, [durationSeconds]);

  // Guards against a slide ever advancing twice for one logical transition:
  // transitioningRef blocks a *new* goTo call from starting while one is
  // already in flight (e.g. an overlapping auto-advance and swipe), and the
  // per-call `advanced` flag blocks the *same* transition's own completion
  // callback from running its body twice, in case the underlying
  // withTiming callback ever fires more than once for a single animation.
  // Without this, a duplicate call skips straight to advanceToIndex a
  // second time — the slide it lands on never gets its full display
  // duration, which looks exactly like "every other slide flashes by".
  const transitioningRef = useRef(false);

  // Slide: the currently-active slot slides out while the other (inactive)
  // slot — already loaded with the next photo and positioned off-screen —
  // slides in, in lockstep, over one continuous animation. Both photos are
  // prefetched up front (see the Image.prefetch effect above), so there's
  // no load-gate to wait on: this is what actually fixes the black-slide
  // bug, since the earlier version slid the current photo fully off-screen
  // first and only then waited for the next photo's onLoad before sliding
  // it in. Fade is untouched — it never had that gap since the same single
  // Image just crossfades in place.
  const goTo = useCallback((nextIndex: number, direction: 1 | -1) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    let advanced = false;
    // Runs on the JS thread (it's only ever invoked via runOnJS below) —
    // setting a plain ref's .current here is safe in a way it would not
    // be from inside the worklet itself.
    const finishAdvance = (settledSlot?: 0 | 1) => {
      if (advanced) return;
      advanced = true;
      transitioningRef.current = false;
      if (settledSlot !== undefined) setActiveSlot(settledSlot);
      advanceToIndex(nextIndex);
      progress.value = 0;
    };
    if (transition === 'slide') {
      const incomingSlot: 0 | 1 = activeSlot === 0 ? 1 : 0;
      const outgoingX = activeSlot === 0 ? slotTranslateX0 : slotTranslateX1;
      const incomingX = incomingSlot === 0 ? slotTranslateX0 : slotTranslateX1;
      setSlotUris((prev) => {
        const next: [string | null, string | null] = [...prev];
        next[incomingSlot] = uris[nextIndex];
        return next;
      });
      incomingX.value = direction * width;
      incomingX.value = withTiming(0, { duration: TRANSITION_PHASE_MS * 2 });
      outgoingX.value = withTiming(-direction * width, { duration: TRANSITION_PHASE_MS * 2 }, (finished) => {
        if (finished) runOnJS(finishAdvance)(incomingSlot);
      });
    } else {
      opacity.value = withTiming(0, { duration: TRANSITION_PHASE_MS }, (finished) => {
        if (finished) {
          runOnJS(finishAdvance)();
          opacity.value = withTiming(1, { duration: TRANSITION_PHASE_MS });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transition, advanceToIndex, activeSlot, uris, width]);

  const advance = useCallback((direction: 1 | -1) => {
    if (uris.length === 0) return;
    goTo((currentIndex + direction + uris.length) % uris.length, direction);
  }, [currentIndex, uris.length, goTo]);

  const togglePaused = useCallback(() => setPaused((p) => {
    // TEMP DEBUG — remove once the stuck-pause bug is diagnosed.
    console.log(`[SLIDESHOW] togglePaused: ${p} -> ${!p}`);
    return !p;
  }), []);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reveals the controls and restarts the idle countdown — call this on
  // every real interaction (tap, swipe, pressing one of the controls
  // themselves) so the controls stay up while someone's actually engaging
  // with the screen and only fade once they've stopped.
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_IDLE_MS);
  }, []);

  useEffect(() => {
    controlsOpacity.value = withTiming(controlsVisible ? 1 : 0, { duration: CONTROLS_FADE_MS });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsVisible]);

  // Starts the initial idle countdown once the slideshow actually has
  // something on screen, and makes sure no stray timeout survives unmount.
  useEffect(() => {
    if (!loading) showControls();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // The sleep timer picker needs the controls to stay put the whole time
  // it's open, however long someone takes to choose — suspend the idle
  // countdown while it's showing, and give the controls a fresh full
  // CONTROLS_IDLE_MS once it closes rather than picking up a countdown
  // that may have been paused partway through.
  useEffect(() => {
    if (showSleepPanel) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      setControlsVisible(true);
    } else {
      showControls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSleepPanel]);

  // Reveal-only first tap, matching Photos/YouTube: while the controls are
  // hidden, a tap just brings them back rather than also pausing — pausing
  // is only what a tap does once the controls are already up.
  const handleTap = useCallback(() => {
    if (!controlsVisible) {
      showControls();
      return;
    }
    showControls();
    togglePaused();
  }, [controlsVisible, showControls, togglePaused]);

  // Runs the auto-advance timer and the visual progress fill for
  // whatever time is actually left on this slide (remainingMsRef).
  // Deliberately does NOT touch remainingMsRef itself, on pause or
  // otherwise — only reads it. advanceToIndex is what resets it on a
  // slide change, and the pause-banking effect below is what decrements
  // it on a pause; if this cleanup also decremented it, a natural slide
  // change (which fires this cleanup too, since currentIndex is a dep)
  // would double-subtract elapsed time from a ref advanceToIndex had
  // already reset moments earlier, corrupting it back toward zero — the
  // bug that made every other slide flash by almost instantly.
  useEffect(() => {
    // TEMP DEBUG — remove once the stuck-pause bug is diagnosed.
    console.log(`[SLIDESHOW] auto-advance effect fired: currentIndex=${currentIndex} paused=${paused} uris.length=${uris.length}`);
    if (paused || uris.length <= 1) return;
    startedAtRef.current = Date.now();
    const remaining = remainingMsRef.current;
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear });
    const timer = setTimeout(() => advance(1), remaining);
    return () => {
      clearTimeout(timer);
      cancelAnimation(progress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, paused, uris.length, advance]);

  // The only place remainingMsRef is decremented — fires solely when
  // `paused` becomes true, never on a natural slide change (it doesn't
  // depend on currentIndex), so it can never race advanceToIndex's reset.
  // Banks whatever time was actually spent since the timer effect above
  // last started, so resuming continues instead of restarting.
  useEffect(() => {
    if (!paused) return;
    remainingMsRef.current = Math.max(0, remainingMsRef.current - (Date.now() - startedAtRef.current));
  }, [paused]);

  // Ambient music is independent of individual slide pause/resume —
  // pausing to read one slide longer shouldn't cut the music, it's
  // ambient, not tied to the visual timer. Plays whichever queue item is
  // current and otherwise continues until the screen is left; the queue
  // as a whole is what loops, not this one file (player.loop stays
  // false — see the didJustFinish listener below).
  useEffect(() => {
    if (ambientQueue.length === 0) {
      player.pause();
      return;
    }
    player.loop = false;
    player.volume = VOLUME_GAIN[ambientVolume];
    // ambientQueueIndex counts monotonically upward rather than wrapping
    // (see the didJustFinish listener below) specifically so this effect
    // always sees a changed dependency and re-fires — a wrapped index
    // that lands back on the same value (e.g. a one-track queue going
    // 0 -> 0) is a no-op React state update, which would silently skip
    // this replace()/play() and leave a single-track soundtrack playing
    // once and then falling silent.
    player.replace(ambientQueue[ambientQueueIndex % ambientQueue.length]);
    player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambientQueue, ambientQueueIndex]);

  // Advances to the next queue item when one finishes — always a genuine
  // increment, never wrapped here, so the effect above always re-fires
  // and can never observe an unchanged index (see its comment for why
  // that matters). The wrap into a valid array position happens only
  // when reading the queue, via % ambientQueue.length above.
  useEffect(() => {
    if (ambientQueue.length === 0) return;
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        setAmbientQueueIndex((i) => i + 1);
      }
    });
    return () => subscription.remove();
  }, [player, ambientQueue]);

  // Guards fadeOutAudio's interval so a second call (e.g. a double-tap on
  // Close before the first fade finishes) can't leave two intervals
  // running at once — without this, an orphaned interval from a stale
  // fade could still be ticking after the one that actually navigated
  // away has unmounted the screen and released the native player,
  // throwing when it next tried to set player.volume on a dead object.
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ramps the ambient track's volume down over TRANSITION_PHASE_MS before
  // pausing it, matching the app's existing unhurried transition pacing
  // rather than an abrupt cut — then calls onDone (always, even when
  // nothing was playing, so callers can unconditionally chain onto it).
  //
  // Every native player call is wrapped in try/catch: expo-audio's shared
  // native object can apparently be released out from under a still-valid
  // JS reference (seen even on a single, non-overlapping fade — not just
  // the double-tap race the fadeIntervalRef guard above handles), and a
  // property set on a released player throws a native FunctionCallException
  // that would otherwise crash the whole app over a purely cosmetic fade.
  // If that happens mid-fade, there's nothing left to animate — just stop
  // and finish closing.
  const fadeOutAudio = useCallback((onDone: () => void) => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    let startVolume: number;
    try {
      if (ambientQueue.length === 0 || !player.playing) {
        onDone();
        return;
      }
      startVolume = player.volume;
    } catch {
      onDone();
      return;
    }
    const steps = 8;
    const stepMs = TRANSITION_PHASE_MS / steps;
    let step = 0;
    fadeIntervalRef.current = setInterval(() => {
      step += 1;
      try {
        player.volume = Math.max(0, startVolume * (1 - step / steps));
        if (step >= steps) {
          clearInterval(fadeIntervalRef.current!);
          fadeIntervalRef.current = null;
          player.pause();
          onDone();
        }
      } catch {
        clearInterval(fadeIntervalRef.current!);
        fadeIntervalRef.current = null;
        onDone();
      }
    }, stepMs);
  }, [ambientQueue, player]);

  // Belt-and-suspenders: if the screen unmounts by some path other than
  // fadeOutAudio's own onDone (e.g. a hardware/gesture back nav racing a
  // fade already in progress), stop the interval before it can touch a
  // player that's about to be released.
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    };
  }, []);

  // The one place that actually leaves this screen — used by the close
  // button and by the sleep timer's expiry, so both get the same
  // fade-then-exit behavior instead of an abrupt cut.
  const handleClose = useCallback(() => {
    // TEMP DEBUG — remove once the stuck-pause bug is diagnosed.
    console.log('[SLIDESHOW] handleClose called');
    fadeOutAudio(() => {
      // dismissTo (not back) so closing lands on History regardless of how
      // deep this screen was reached — it's always the last stop in the
      // slideshow flow launched from History's header icon.
      console.log('[SLIDESHOW] fadeOutAudio onDone -> router.dismissTo(history)');
      router.dismissTo('/(tabs)/history');
    });
  }, [fadeOutAudio, router]);

  // Session-only real-wall-clock countdown — deliberately not tied to
  // slide pause/resume (see the ambient-music effect above for the same
  // reasoning): "stop in 10 minutes" means 10 real minutes, not 10
  // minutes of unpaused viewing.
  useEffect(() => {
    if (sleepMinutes === null) {
      setSleepRemainingLabel(null);
      return;
    }
    const deadline = Date.now() + sleepMinutes * 60_000;
    const tick = () => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        setSleepRemainingLabel(null);
        handleClose();
        return;
      }
      setSleepRemainingLabel(`${Math.ceil(remainingMs / 60_000)} min`);
    };
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepMinutes]);

  const chooseSleepTimer = (minutes: number | null) => {
    setSleepMinutes(minutes);
    setShowSleepPanel(false);
  };

  const handleShare = useCallback(async () => {
    showControls();
    setPaused(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) throw new Error('Sharing is not available on this device');
      await Sharing.shareAsync(uris[currentIndex], { mimeType: 'image/png', dialogTitle: 'Share Quote' });
    } catch (err) {
      Alert.alert('Share Failed', err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, [uris, currentIndex, showControls]);

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(handleTap)();
  });

  const pan = Gesture.Pan()
    // Requires real swipe motion so a plain tap-to-pause isn't claimed by
    // this gesture instead — same fix needed for the photo pan/double-tap
    // conflict in the quote card editor.
    .minDistance(20)
    .onEnd((e) => {
      runOnJS(showControls)();
      if (e.translationX < -50) runOnJS(advance)(1);
      else if (e.translationX > 50) runOnJS(advance)(-1);
    });

  const gesture = Gesture.Race(pan, tap);

  const fadeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const slot0AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slotTranslateX0.value }],
  }));

  const slot1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slotTranslateX1.value }],
  }));

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
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
        {transition === 'slide' ? (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, slot0AnimatedStyle]}>
              {slotUris[0] && <Image source={{ uri: slotUris[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />}
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, slot1AnimatedStyle]}>
              {slotUris[1] && <Image source={{ uri: slotUris[1] }} style={StyleSheet.absoluteFill} contentFit="cover" />}
            </Animated.View>
          </>
        ) : (
          <Animated.View style={[StyleSheet.absoluteFill, fadeAnimatedStyle]}>
            <Image source={{ uri: uris[currentIndex] }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        )}

        <Animated.View
          style={[StyleSheet.absoluteFill, controlsAnimatedStyle]}
          pointerEvents={controlsVisible ? 'box-none' : 'none'}
          accessibilityElementsHidden={!controlsVisible}
          importantForAccessibility={controlsVisible ? 'auto' : 'no-hide-descendants'}
        >
          <View style={[styles.progressRow, { top: insets.top + 8 }]} pointerEvents="none">
            {uris.map((_, i) => (
              <View key={i} style={styles.progressSegment}>
                {i < currentIndex && <View style={styles.progressSegmentFilled} />}
                {i === currentIndex && <Animated.View style={[styles.progressSegmentFilled, progressFillStyle]} />}
              </View>
            ))}
          </View>

          <IconButton
            style={[styles.shareButton, { top: insets.top + 24 }]}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share this photo"
          >
            <IconSymbol name="paperplane.fill" size={16} color="#f0ead6" />
          </IconButton>

          <IconButton
            style={[styles.timerButton, { top: insets.top + 24 }]}
            onPress={() => setShowSleepPanel((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Sleep timer"
          >
            <IconSymbol name="timer" size={16} color={sleepMinutes !== null ? '#c9b97a' : '#f0ead6'} />
          </IconButton>

          {sleepRemainingLabel && (
            <View style={[styles.sleepBadge, { top: insets.top + 31 }]} pointerEvents="none">
              <Text style={styles.sleepBadgeText}>{sleepRemainingLabel}</Text>
            </View>
          )}

          <IconButton
            style={[styles.closeButton, { top: insets.top + 24 }]}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close slideshow"
            hitSlop={8}
          >
            <IconSymbol name="xmark" size={18} color="#f0ead6" />
          </IconButton>
        </Animated.View>

        {showSleepPanel && (
          <View style={[styles.sleepPanel, { top: insets.top + 64 }]}>
            <Text style={styles.sleepPanelLabel}>Sleep Timer</Text>
            <View style={styles.sleepChipRow}>
              <TouchableOpacity
                onPress={() => chooseSleepTimer(null)}
                accessibilityRole="radio"
                accessibilityState={{ selected: sleepMinutes === null }}
                style={[styles.sleepChip, sleepMinutes === null && styles.sleepChipSelected]}
              >
                <Text style={[styles.sleepChipText, sleepMinutes === null && styles.sleepChipTextSelected]}>Off</Text>
              </TouchableOpacity>
              {SLEEP_TIMER_OPTIONS_MIN.map((minutes) => {
                const selected = sleepMinutes === minutes;
                return (
                  <TouchableOpacity
                    key={minutes}
                    onPress={() => chooseSleepTimer(minutes)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.sleepChip, selected && styles.sleepChipSelected]}
                  >
                    <Text style={[styles.sleepChipText, selected && styles.sleepChipTextSelected]}>{minutes} min</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

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
    backgroundColor: 'rgba(15,14,12,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,14,12,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerButton: {
    position: 'absolute',
    left: 62,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,14,12,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepBadge: {
    position: 'absolute',
    left: 106,
    backgroundColor: 'rgba(15,14,12,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sleepBadgeText: {
    fontSize: 11,
    color: '#c9b97a',
    fontWeight: '600',
  },
  sleepPanel: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(15,14,12,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4a4540',
    padding: 14,
    gap: 8,
  },
  sleepPanelLabel: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sleepChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    maxWidth: 220,
  },
  sleepChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  sleepChipSelected: {
    borderColor: '#c9b97a',
    backgroundColor: 'rgba(201,185,122,0.15)',
  },
  sleepChipText: {
    fontSize: 12,
    color: '#a89f88',
  },
  sleepChipTextSelected: {
    color: '#f0ead6',
    fontWeight: '600',
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
