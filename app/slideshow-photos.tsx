import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, type LayoutChangeEvent } from 'react-native';
// react-native-gesture-handler's ScrollView, not the plain react-native one
// — it's gesture-aware, letting a child tile's Gesture.Pan() properly win
// the touch once its activateAfterLongPress threshold fires. The plain
// ScrollView doesn't negotiate with RNGH gestures at all: during the
// long-press wait, its own native scroll could win the touch instead,
// which is what "dragging the first tile drags everything" actually was.
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { DraggableGridTile } from '@/components/DraggableGridTile';

interface SlideshowPhoto {
  id: string;
  assetId: string;
  sortOrder: number;
  uri: string;
}

type SlideshowTransition = 'fade' | 'slide';
type AmbientVolume = 'low' | 'medium' | 'high';

const COLUMN_COUNT = 3;
const DEFAULT_DURATION_SECONDS = 7;
const DURATION_OPTIONS = [3, 5, 7, 10, 15];
const TRANSITION_OPTIONS: { label: string; value: SlideshowTransition }[] = [
  { label: 'Fade', value: 'fade' },
  { label: 'Slide', value: 'slide' },
];
const VOLUME_OPTIONS: { label: string; value: AmbientVolume }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

export default function SlideshowPhotosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const [collectionName, setCollectionName] = useState('Slideshow');
  const [photos, setPhotos] = useState<SlideshowPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [transition, setTransition] = useState<SlideshowTransition>('fade');
  const [ambientVolume, setAmbientVolume] = useState<AmbientVolume>('medium');
  // The soundtrack currently assigned to this slideshow, if any — the
  // soundtrack itself (its name, tracks) is edited on its own screen,
  // reached via the picker at app/soundtracks.tsx; this screen only
  // needs to know which one (if any) is assigned, to show its name and
  // gate the Volume section below.
  const [soundtrackId, setSoundtrackId] = useState<string | null>(null);
  const [soundtrackName, setSoundtrackName] = useState<string | null>(null);
  // Which photo (by id) is currently being dragged, if any — disables
  // every other tile's own drag gesture for the duration, the same
  // .enabled(!isEditing) technique DraggableTextBox uses.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  // A count, not a boolean, so overlapping touch sequences (e.g. a quick
  // second tap landing before the first one's onFinalize fires) can't
  // leave scrolling stuck disabled — the grid only scrolls again once
  // every outstanding tile touch has actually ended.
  const [touchCount, setTouchCount] = useState(0);
  // A photo removal is held for a few seconds before actually hitting the
  // database, the same undo-window pattern as History's quote delete
  // (app/(tabs)/history.tsx) — the photo is already gone from `photos`
  // (optimistic), this just tracks what to restore if Undo is tapped and
  // the timer that commits the real delete if it isn't.
  const [pendingRemove, setPendingRemove] = useState<{ photo: SlideshowPhoto; timer: ReturnType<typeof setTimeout> } | null>(null);
  // Mirrors pendingRemove for use inside the load-on-focus effect below,
  // whose cleanup needs the latest value without being recreated on every
  // pendingRemove change — same reason history.tsx uses this pattern.
  const pendingRemoveRef = useRef<typeof pendingRemove>(null);
  useEffect(() => {
    pendingRemoveRef.current = pendingRemove;
  }, [pendingRemove]);

  const load = useCallback(async () => {
    if (!collectionId) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    const [{ data, error }, { data: collectionRow }] = await Promise.all([
      supabase
        .from('slideshow_photos')
        .select('id, asset_id, sort_order')
        .eq('user_id', session.user.id)
        .eq('collection_id', collectionId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('slideshow_collections')
        .select('name, slideshow_duration_seconds, slideshow_transition, ambient_volume, soundtrack_id')
        .eq('id', collectionId)
        .single(),
    ]);

    if (collectionRow) {
      setCollectionName(collectionRow.name);
      setDurationSeconds(collectionRow.slideshow_duration_seconds ?? DEFAULT_DURATION_SECONDS);
      setTransition(collectionRow.slideshow_transition === 'slide' ? 'slide' : 'fade');
      setAmbientVolume(collectionRow.ambient_volume === 'low' || collectionRow.ambient_volume === 'high' ? collectionRow.ambient_volume : 'medium');
      setSoundtrackId(collectionRow.soundtrack_id ?? null);
      if (collectionRow.soundtrack_id) {
        const { data: soundtrackRow } = await supabase
          .from('soundtracks')
          .select('name')
          .eq('id', collectionRow.soundtrack_id)
          .single();
        setSoundtrackName(soundtrackRow?.name ?? null);
      } else {
        setSoundtrackName(null);
      }
    }

    if (error || !data) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    const resolved = await Promise.all(
      data.map(async (row) => {
        try {
          const info = await MediaLibrary.getAssetInfoAsync(row.asset_id);
          const uri = info?.localUri ?? info?.uri ?? null;
          return { id: row.id, assetId: row.asset_id, sortOrder: row.sort_order, uri };
        } catch {
          return { id: row.id, assetId: row.asset_id, sortOrder: row.sort_order, uri: null as string | null };
        }
      })
    );

    // An asset that no longer resolves (deleted from Photos since being
    // added) is dropped from the list and cleaned up server-side, rather
    // than silently accumulating dead rows.
    const stale = resolved.filter((p) => !p.uri);
    if (stale.length > 0) {
      await supabase.from('slideshow_photos').delete().in('id', stale.map((p) => p.id));
    }

    setPhotos(resolved.filter((p): p is SlideshowPhoto => !!p.uri));
    setLoading(false);
  }, [collectionId]);

  useFocusEffect(useCallback(() => {
    load();
    // Leaving the screen mid-undo-window commits the removal right away
    // rather than letting its timer fire later in the background —
    // otherwise coming back before that timer elapses would re-fetch and
    // show the "removed" photo still in the collection, since the
    // database delete hadn't actually happened yet.
    return () => {
      const pending = pendingRemoveRef.current;
      if (pending) {
        clearTimeout(pending.timer);
        supabase.from('slideshow_photos').delete().eq('id', pending.photo.id);
        setPendingRemove(null);
      }
    };
  }, [load]));

  const addPhotos = async () => {
    if (!collectionId) return;
    setAdding(true);
    try {
      // Deliberately not requesting MediaLibrary read permission here.
      // Doing so on every "Add Photos" tap re-triggers iOS's photo-access
      // flow, and once the app already has Limited Access granted from an
      // earlier add, that can surface the system's "manage your selected
      // photos" screen instead of a fresh picker — which shows everything
      // ever granted as pre-selected, so confirming it hands back every
      // photo instead of just the new ones (the bug this comment is
      // replacing a fix for). The personal-photo picker in the quote card
      // editor uses this same API with no permission call and has never
      // shown the problem.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (result.canceled) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const existingIds = new Set(photos.map((p) => p.assetId));
      const withIds = result.assets.filter((a) => !!a.assetId);
      const newAssets = withIds.filter((a) => !existingIds.has(a.assetId as string));

      if (withIds.length < result.assets.length) {
        Alert.alert(
          'Some Photos Skipped',
          "A few selected photos couldn't be added reliably — allow Photos access in Settings for consistent results."
        );
      }
      if (newAssets.length === 0) return;

      let nextOrder = photos.length > 0 ? Math.max(...photos.map((p) => p.sortOrder)) + 1 : 0;
      const rows = newAssets.map((a) => ({
        user_id: session.user.id,
        collection_id: collectionId,
        asset_id: a.assetId as string,
        sort_order: nextOrder++,
      }));

      // upsert + ignoreDuplicates rather than a plain insert: the table
      // has a unique (user_id, collection_id, asset_id) constraint — the
      // same photo can belong to more than one collection, just not
      // appear twice within the same one — and if the client-side
      // existingIds check above ever misses a case (a stale photos list,
      // a race between two rapid adds), this makes re-adding an
      // already-present photo a harmless no-op instead of a thrown error.
      const { error } = await supabase
        .from('slideshow_photos')
        .upsert(rows, { onConflict: 'user_id,collection_id,asset_id', ignoreDuplicates: true });
      if (error) throw error;
      await load();
    } catch (err) {
      Alert.alert('Add Failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setAdding(false);
    }
  };

  // How long an accidental removal stays undoable before it actually hits
  // the database — same window as History's quote delete.
  const UNDO_WINDOW_MS = 5000;

  const commitRemovePhoto = async (id: string) => {
    const { error } = await supabase.from('slideshow_photos').delete().eq('id', id);
    if (error) {
      await load();
      Alert.alert('Remove Failed', error.message);
    }
    setPendingRemove((current) => (current?.photo.id === id ? null : current));
  };

  const undoRemovePhoto = () => {
    if (!pendingRemove) return;
    clearTimeout(pendingRemove.timer);
    const restored = pendingRemove.photo;
    setPhotos((prev) => {
      // Reinsert ahead of the first photo with a higher sortOrder than the
      // restored one, so it lands back in its original spot rather than
      // just tacking onto the end.
      const next = [...prev];
      const insertAt = next.findIndex((p) => p.sortOrder > restored.sortOrder);
      next.splice(insertAt === -1 ? next.length : insertAt, 0, restored);
      return next;
    });
    setPendingRemove(null);
  };

  const removePhoto = (id: string) => {
    const removed = photos.find((p) => p.id === id);
    if (!removed) return;
    // Optimistic, but not committed yet — see pendingRemove above.
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    const timer = setTimeout(() => commitRemovePhoto(id), UNDO_WINDOW_MS);
    setPendingRemove({ photo: removed, timer });
  };

  // Rewrites every photo's sort_order from its position in the given
  // (already reordered) array — the same bulk-rewrite-on-drop shape
  // lib/ambientPlaylist.ts's reorderItems already uses for the ambient
  // playlist. Called after DraggableFlatList hands back a drop's final
  // order; local state is updated optimistically by the caller.
  const reorderPhotos = async (reordered: SlideshowPhoto[]) => {
    await Promise.all(
      reordered.map((photo, index) =>
        supabase.from('slideshow_photos').update({ sort_order: index }).eq('id', photo.id)
      )
    );
  };

  // Called by a DraggableGridTile on release with its origin and computed
  // target index — splices the photo into its new spot, updates local
  // state optimistically (the same pattern removePhoto already uses), and
  // persists via reorderPhotos above.
  const handleDrop = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      reorderPhotos(next);
      return next;
    });
  };

  const handleGridLayout = (e: LayoutChangeEvent) => {
    setGridWidth(e.nativeEvent.layout.width);
  };

  // Both write straight through — unlike the quote-card editor's
  // formatting, there's no expensive capture step to defer a commit
  // past, so there's nothing draft-only to gain by staging these. Settings
  // live on the collection itself, not the user's profile, since the
  // whole point of separate collections is that each can be paced/styled
  // differently.
  const chooseDuration = async (seconds: number) => {
    if (!collectionId) return;
    setDurationSeconds(seconds);
    await supabase.from('slideshow_collections').update({ slideshow_duration_seconds: seconds }).eq('id', collectionId);
  };

  const chooseTransition = async (value: SlideshowTransition) => {
    if (!collectionId) return;
    setTransition(value);
    await supabase.from('slideshow_collections').update({ slideshow_transition: value }).eq('id', collectionId);
  };

  const chooseAmbientVolume = async (value: AmbientVolume) => {
    if (!collectionId) return;
    setAmbientVolume(value);
    await supabase.from('slideshow_collections').update({ ambient_volume: value }).eq('id', collectionId);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Slideshows"
        >
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{collectionName}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setShowSettings((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Slideshow playback settings"
          >
            <IconSymbol name="gearshape" size={20} color={showSettings ? '#f0ead6' : '#c9b97a'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/slideshow-play', params: { collectionId } })}
            disabled={photos.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Play slideshow"
          >
            <IconSymbol name="play.rectangle" size={20} color={photos.length === 0 ? '#4a4540' : '#c9b97a'} />
          </TouchableOpacity>
        </View>
      </View>

      {showSettings && (
        <View style={styles.settingsPanel}>
          <Text style={styles.settingsLabel}>Duration</Text>
          <View style={styles.chipRow}>
            {DURATION_OPTIONS.map((seconds) => {
              const selected = durationSeconds === seconds;
              return (
                <TouchableOpacity
                  key={seconds}
                  onPress={() => chooseDuration(seconds)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{seconds}s</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.settingsLabel}>Transition</Text>
          <View style={styles.chipRow}>
            {TRANSITION_OPTIONS.map((option) => {
              const selected = transition === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => chooseTransition(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.settingsLabel}>Soundtrack</Text>
          <TouchableOpacity
            style={styles.ambientMusicRow}
            onPress={() => router.push({ pathname: '/soundtracks', params: { pickForCollectionId: collectionId } })}
            accessibilityRole="button"
            accessibilityLabel={`Soundtrack, currently ${soundtrackName ?? 'None'}`}
          >
            <Text style={styles.ambientMusicValue}>{soundtrackName ?? 'None'}</Text>
            <IconSymbol name="chevron.right" size={14} color="#8a7e6e" />
          </TouchableOpacity>

          {soundtrackId !== null && (
            <>
              <Text style={styles.settingsLabel}>Volume</Text>
              <View style={styles.chipRow}>
                {VOLUME_OPTIONS.map((option) => {
                  const selected = ambientVolume === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => chooseAmbientVolume(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>
      )}

      {!loading && photos.length > 1 && (
        <Text style={styles.reorderHint}>Press and drag a photo to reorder</Text>
      )}

      {loading ? (
        <ActivityIndicator style={styles.loading} color="#c9b97a" />
      ) : photos.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="photo.on.rectangle" size={40} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptySubtitle}>
            Add the quote cards you&apos;ve saved to Photos — curated or personal photo — to build a slideshow.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} scrollEnabled={touchCount === 0}>
          <View style={styles.gridRow} onLayout={handleGridLayout}>
            {gridWidth > 0 &&
              photos.map((photo, index) => (
                <Animated.View key={photo.id} layout={LinearTransition}>
                  <DraggableGridTile
                    id={photo.id}
                    uri={photo.uri}
                    index={index}
                    count={photos.length}
                    columnCount={COLUMN_COUNT}
                    cellSize={gridWidth / COLUMN_COUNT}
                    activeId={activeId}
                    onDragStart={setActiveId}
                    onDragEnd={() => setActiveId(null)}
                    onDrop={handleDrop}
                    onRemove={removePhoto}
                    onTouchBegin={() => setTouchCount((c) => c + 1)}
                    onTouchEnd={() => setTouchCount((c) => Math.max(0, c - 1))}
                  />
                </Animated.View>
              ))}
          </View>
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.addButton, { bottom: insets.bottom + 16 }]}
        onPress={addPhotos}
        disabled={adding}
        accessibilityRole="button"
        accessibilityLabel="Add photos"
      >
        {adding ? (
          <ActivityIndicator color="#0f0e0c" />
        ) : (
          <>
            <IconSymbol name="plus" size={16} color="#0f0e0c" />
            <Text style={styles.addButtonText}>Add Photos</Text>
          </>
        )}
      </TouchableOpacity>

      {pendingRemove && (
        <View style={[styles.undoBanner, { bottom: insets.bottom + 76 }]}>
          <Text style={styles.undoBannerText}>Photo removed</Text>
          <TouchableOpacity onPress={undoRemovePhoto} accessibilityRole="button" accessibilityLabel="Undo remove">
            <Text style={styles.undoBannerAction}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
  },
  undoBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15,14,12,0.95)',
    borderWidth: 1,
    borderColor: '#4a4540',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  undoBannerText: {
    fontSize: 14,
    color: '#f0ead6',
  },
  undoBannerAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c9b97a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f0ead6',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  settingsPanel: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4a4540',
    padding: 16,
    gap: 8,
  },
  settingsLabel: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  chipSelected: {
    borderColor: '#c9b97a',
    backgroundColor: 'rgba(201,185,122,0.15)',
  },
  chipText: {
    fontSize: 13,
    color: '#a89f88',
  },
  chipTextSelected: {
    color: '#f0ead6',
    fontWeight: '600',
  },
  ambientMusicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  ambientMusicValue: {
    fontSize: 14,
    color: '#f0ead6',
  },
  loading: {
    marginTop: 60,
  },
  reorderHint: {
    fontSize: 11,
    color: '#6a6050',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
  },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 100,
    flexGrow: 1,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6a6050',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6a6050',
    textAlign: 'center',
    lineHeight: 20,
  },
  addButton: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#c9b97a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f0e0c',
  },
});
