import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { listAmbientTracks, getTrackMoods, type AmbientTrack } from '@/lib/ambientTracks';

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
  const [tracks, setTracks] = useState<AmbientTrack[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [ambientTrackId, setAmbientTrackId] = useState<string | null>(null);
  const [ambientVolume, setAmbientVolume] = useState<AmbientVolume>('medium');

  const load = useCallback(async () => {
    if (!collectionId) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    const [{ data, error }, { data: collectionRow }, tracksResult] = await Promise.all([
      supabase
        .from('slideshow_photos')
        .select('id, asset_id, sort_order')
        .eq('user_id', session.user.id)
        .eq('collection_id', collectionId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('slideshow_collections')
        .select('name, slideshow_duration_seconds, slideshow_transition, ambient_track_id, ambient_volume')
        .eq('id', collectionId)
        .single(),
      listAmbientTracks().catch(() => [] as AmbientTrack[]),
    ]);

    setTracks(tracksResult);

    if (collectionRow) {
      setCollectionName(collectionRow.name);
      setDurationSeconds(collectionRow.slideshow_duration_seconds ?? DEFAULT_DURATION_SECONDS);
      setTransition(collectionRow.slideshow_transition === 'slide' ? 'slide' : 'fade');
      setAmbientTrackId(collectionRow.ambient_track_id ?? null);
      setAmbientVolume(collectionRow.ambient_volume === 'low' || collectionRow.ambient_volume === 'high' ? collectionRow.ambient_volume : 'medium');
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  const removePhoto = async (id: string) => {
    // Optimistic, but not fire-and-forget: the previous version never
    // awaited or checked this delete, so a failed request (network blip,
    // anything) left the row in Supabase while the UI already showed it
    // gone — Play does its own fresh fetch and would still include it.
    // Reverting the optimistic removal on failure keeps what's on screen
    // truthful to what's actually in the database.
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from('slideshow_photos').delete().eq('id', id);
    if (error) {
      await load();
      Alert.alert('Remove Failed', error.message);
    }
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

  // Selecting "None" (id null) is how volume becomes moot — there's no
  // separate off state for volume itself, it's just unused until a real
  // track is chosen again.
  const chooseAmbientTrack = async (trackId: string | null) => {
    if (!collectionId) return;
    setAmbientTrackId(trackId);
    await supabase.from('slideshow_collections').update({ ambient_track_id: trackId }).eq('id', collectionId);
  };

  const chooseAmbientVolume = async (value: AmbientVolume) => {
    if (!collectionId) return;
    setAmbientVolume(value);
    await supabase.from('slideshow_collections').update({ ambient_volume: value }).eq('id', collectionId);
  };

  const trackMoods = getTrackMoods(tracks);
  const filteredTracks = selectedMood ? tracks.filter((track) => track.mood === selectedMood) : tracks;

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

          <Text style={styles.settingsLabel}>Ambient Music</Text>
          {trackMoods.length > 0 && (
            <View style={styles.chipRow}>
              {['all', ...trackMoods].map((mood) => {
                const value = mood === 'all' ? null : mood;
                const selected = selectedMood === value;
                const label = mood === 'all' ? 'All' : mood.charAt(0).toUpperCase() + mood.slice(1);
                return (
                  <TouchableOpacity
                    key={mood}
                    onPress={() => setSelectedMood(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Filter ambient music: ${label}`}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <View style={styles.chipRow}>
            {selectedMood === null && (
              <TouchableOpacity
                onPress={() => chooseAmbientTrack(null)}
                accessibilityRole="radio"
                accessibilityState={{ selected: ambientTrackId === null }}
                style={[styles.chip, ambientTrackId === null && styles.chipSelected]}
              >
                <Text style={[styles.chipText, ambientTrackId === null && styles.chipTextSelected]}>None</Text>
              </TouchableOpacity>
            )}
            {filteredTracks.map((track) => {
              const selected = ambientTrackId === track.id;
              return (
                <TouchableOpacity
                  key={track.id}
                  onPress={() => chooseAmbientTrack(track.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{track.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {ambientTrackId !== null && (
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

      {loading ? (
        <ActivityIndicator style={styles.loading} color="#c9b97a" />
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="photo.on.rectangle" size={40} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
              <Text style={styles.emptyTitle}>No photos yet</Text>
              <Text style={styles.emptySubtitle}>
                Add the quote cards you&apos;ve saved to Photos — curated or personal photo — to build a slideshow.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.tile}>
              <Image source={{ uri: item.uri }} style={styles.tileImage} contentFit="cover" />
              <TouchableOpacity
                style={styles.tileRemove}
                onPress={() => removePhoto(item.id)}
                accessibilityRole="button"
                accessibilityLabel="Remove from slideshow"
                hitSlop={8}
              >
                <IconSymbol name="xmark.circle.fill" size={20} color="#f0ead6" />
              </TouchableOpacity>
            </View>
          )}
        />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
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
  loading: {
    marginTop: 60,
  },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 100,
    flexGrow: 1,
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
  tile: {
    flex: 1 / COLUMN_COUNT,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
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
