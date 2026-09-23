import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useAudioPlayer } from 'expo-audio';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { IconButton } from '@/components/ui/IconButton';
import { listAmbientTracks, getTrackMoods, type AmbientTrack } from '@/lib/ambientTracks';
import { listPlaylistItems, addCuratedItem, addPersonalItem, removeItem, reorderItems, type PlaylistItem } from '@/lib/ambientPlaylist';
import { renameSoundtrack } from '@/lib/soundtracks';

// Editor for one soundtrack's name and ordered track list — reached from
// the soundtrack picker (app/soundtracks.tsx), not from a slideshow
// directly. A soundtrack has no collection of its own; it's assigned to
// slideshows independently (slideshow_collections.soundtrack_id), so
// volume — a property of how loud a given slideshow plays it — lives on
// that slideshow's own settings panel (app/slideshow-photos.tsx), not
// here.
//
// The playlist model — an ordered, reorderable queue mixing curated and
// personal tracks — mirrors what a single slideshow's playlist looked
// like before soundtracks became reusable, standalone objects.
export default function SoundtrackEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { soundtrackId } = useLocalSearchParams<{ soundtrackId: string }>();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tracks, setTracks] = useState<AmbientTrack[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  // Which curated track (if any) is currently sounding — a quick audition
  // before committing it to the playlist, distinct from playlist
  // membership itself. One shared player, so starting a new preview
  // always replaces whatever was previewing rather than layering two.
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const previewPlayer = useAudioPlayer(null);

  const load = useCallback(async () => {
    if (!soundtrackId) { setLoading(false); return; }
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const [{ data: soundtrackRow }, tracksResult, items] = await Promise.all([
      supabase.from('soundtracks').select('name').eq('id', soundtrackId).single(),
      listAmbientTracks().catch(() => [] as AmbientTrack[]),
      listPlaylistItems(soundtrackId).catch(() => [] as PlaylistItem[]),
    ]);

    setUserId(session?.user.id ?? null);
    setTracks(tracksResult);
    setPlaylist(items);
    if (soundtrackRow) setName(soundtrackRow.name);
    setLoading(false);
  }, [soundtrackId]);

  useFocusEffect(useCallback(() => {
    load();
    // Leaving the screen stops any active preview rather than letting it
    // keep playing in the background — the same "clean up on blur" shape
    // already used this session for pending deletes/removals. Wrapped in
    // try/catch like every other native previewPlayer call here: navigating
    // away can release the native player before this cleanup runs, and
    // calling pause() on the dead object throws a FunctionCallException
    // that would otherwise crash the app over what's just a background
    // audio stop (same issue app/slideshow-play.tsx's fadeOutAudio guards
    // against).
    return () => {
      try {
        previewPlayer.pause();
      } catch {
        // Native player already released — nothing left to pause.
      }
      setPreviewingTrackId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]));

  // Clears the pause icon once a preview finishes on its own — the same
  // didJustFinish event app/slideshow-play.tsx keys its queue-advance off.
  useEffect(() => {
    const subscription = previewPlayer.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) setPreviewingTrackId(null);
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPlayer]);

  const togglePreview = (track: AmbientTrack) => {
    try {
      if (previewingTrackId === track.id) {
        previewPlayer.pause();
        setPreviewingTrackId(null);
      } else {
        previewPlayer.replace(track.url);
        previewPlayer.play();
        setPreviewingTrackId(track.id);
      }
    } catch {
      // Native player already released — nothing to preview against.
      setPreviewingTrackId(null);
    }
  };

  // Lighter than re-running the whole load() — used after a mutation,
  // where the curated track list and name haven't changed, only the
  // playlist itself.
  const refreshPlaylist = useCallback(async () => {
    if (!soundtrackId) return;
    setPlaylist(await listPlaylistItems(soundtrackId).catch(() => []));
  }, [soundtrackId]);

  const commitName = async () => {
    const trimmed = name.trim();
    if (!soundtrackId || trimmed.length === 0) return;
    if (trimmed !== name) setName(trimmed);
    try {
      await renameSoundtrack(soundtrackId, trimmed);
    } catch (err) {
      Alert.alert('Rename Failed', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  // Tapping a curated track toggles its membership in the playlist —
  // "selected" here means "already in the playlist," not "is the sole
  // choice" the way a single-select radio would. Removal is optimistic
  // (the item's id is already known); adding isn't, since the new row's
  // id only exists once the server assigns it — a quick refetch after is
  // simpler than fabricating a temporary id.
  const toggleCuratedTrack = async (trackId: string) => {
    if (!soundtrackId || !userId) return;
    const existing = playlist.find((item) => item.sourceType === 'curated' && item.curatedTrackId === trackId);
    try {
      if (existing) {
        setPlaylist((prev) => prev.filter((i) => i.id !== existing.id));
        await removeItem(existing);
      } else {
        await addCuratedItem(soundtrackId, userId, trackId);
        await refreshPlaylist();
      }
    } catch (err) {
      Alert.alert('Something Went Wrong', err instanceof Error ? err.message : 'Please try again.');
      await refreshPlaylist();
    }
  };

  // Files-app document picker only — it can reach anything actually saved
  // in Files (On My iPhone, iCloud Drive, exported recordings), but never
  // the Apple Music library, which is DRM-gated and inaccessible to
  // third-party pickers. Adds a new playlist item rather than replacing a
  // single slot — can be tapped repeatedly to add several personal files.
  const choosePersonalTrack = async () => {
    if (!soundtrackId || !userId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      await addPersonalItem(soundtrackId, userId, asset.uri, asset.name);
      await refreshPlaylist();
    } catch (err) {
      Alert.alert('Couldn’t Add Audio', err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const handleRemoveItem = async (item: PlaylistItem) => {
    setPlaylist((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await removeItem(item);
    } catch (err) {
      Alert.alert('Remove Failed', err instanceof Error ? err.message : 'Something went wrong.');
      await refreshPlaylist();
    }
  };

  // Up/down buttons rather than drag-and-drop — playlists here are always
  // small (single digits), so a plainer control does the job without
  // reaching for a new dependency. Reorders optimistically, then persists
  // the whole new order in one go.
  const moveItem = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= playlist.length) return;
    const reordered = [...playlist];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setPlaylist(reordered);
    try {
      await reorderItems(reordered);
    } catch (err) {
      Alert.alert('Reorder Failed', err instanceof Error ? err.message : 'Something went wrong.');
      await refreshPlaylist();
    }
  };

  const trackMoods = getTrackMoods(tracks);
  const searchQueryNormalized = searchQuery.trim().toLowerCase();
  const filteredTracks = tracks
    .filter((track) => (selectedMood ? track.mood === selectedMood : true))
    .filter((track) => (searchQueryNormalized.length === 0 ? true : track.name.toLowerCase().includes(searchQueryNormalized)));

  const itemLabel = (item: PlaylistItem): string => {
    if (item.sourceType === 'personal') return item.personalFileName ?? 'Audio file';
    return tracks.find((t) => t.id === item.curatedTrackId)?.name ?? item.curatedTrackId ?? 'Track';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/soundtracks'))}
          accessibilityRole="button"
          accessibilityLabel="Back to soundtracks"
        >
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
        </IconButton>
        <TextInput
          style={styles.headerTitleInput}
          value={name}
          onChangeText={setName}
          onBlur={commitName}
          placeholder="Soundtrack name"
          placeholderTextColor="#6a6050"
          returnKeyType="done"
          onSubmitEditing={commitName}
        />
        <IconButton
          onPress={() => router.dismissTo('/(tabs)/history')}
          accessibilityRole="button"
          accessibilityLabel="Back to History"
          hitSlop={8}
        >
          <IconSymbol name="books.vertical.fill" size={18} color="#c9b97a" />
        </IconButton>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color="#c9b97a" />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.searchContainer}>
            <IconSymbol name="magnifyingglass" size={16} color="#8a7e6e" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tracks..."
              placeholderTextColor="#8a7e6e"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search tracks"
            />
            {searchQuery.length > 0 && (
              <IconButton
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <IconSymbol name="xmark.circle.fill" size={16} color="#8a7e6e" />
              </IconButton>
            )}
          </View>

          {trackMoods.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Mood</Text>
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
            </>
          )}

          <View style={styles.sectionLabelRow}>
            <Text style={[styles.sectionLabel, styles.sectionLabelInRow]}>Tracks</Text>
            <Text style={styles.sectionHint}>Tap to preview · tap + to add</Text>
          </View>
          {filteredTracks.length === 0 && (
            <Text style={styles.emptyPlaylistText}>No tracks match.</Text>
          )}
          <View style={styles.chipRow}>
            {filteredTracks.map((track) => {
              const inPlaylist = playlist.some((item) => item.sourceType === 'curated' && item.curatedTrackId === track.id);
              const isPreviewing = previewingTrackId === track.id;
              return (
                <View key={track.id} style={[styles.chip, styles.trackChip, inPlaylist && styles.chipSelected]}>
                  <TouchableOpacity
                    onPress={() => togglePreview(track)}
                    accessibilityRole="button"
                    accessibilityLabel={`${isPreviewing ? 'Pause' : 'Preview'} ${track.name}`}
                    style={styles.trackChipPreview}
                  >
                    <IconSymbol
                      name={isPreviewing ? 'pause.circle' : 'play.circle'}
                      size={16}
                      color={inPlaylist ? '#f0ead6' : '#a89f88'}
                    />
                    <Text style={[styles.chipText, inPlaylist && styles.chipTextSelected]}>{track.name}</Text>
                  </TouchableOpacity>
                  <IconButton
                    onPress={() => toggleCuratedTrack(track.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: inPlaylist }}
                    accessibilityLabel={`${inPlaylist ? 'Remove' : 'Add'} ${track.name} ${inPlaylist ? 'from' : 'to'} your playlist`}
                    hitSlop={8}
                  >
                    <IconSymbol
                      name={inPlaylist ? 'checkmark.circle.fill' : 'plus.circle'}
                      size={18}
                      color={inPlaylist ? '#c9b97a' : '#a89f88'}
                    />
                  </IconButton>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.chip, styles.choosePersonalTrackButton]}
            onPress={choosePersonalTrack}
            accessibilityRole="button"
            accessibilityLabel="Choose an audio file from your device"
          >
            <Text style={styles.chipText}>Choose an audio file</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>Your Playlist</Text>
          {playlist.length === 0 ? (
            <Text style={styles.emptyPlaylistText}>No tracks yet — add some above.</Text>
          ) : (
            <View style={styles.playlistList}>
              {playlist.map((item, index) => (
                <View key={item.id} style={styles.playlistRow}>
                  <Text style={styles.playlistRowName} numberOfLines={1}>{itemLabel(item)}</Text>
                  <View style={styles.playlistRowActions}>
                    <IconButton
                      onPress={() => moveItem(index, -1)}
                      disabled={index === 0}
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${itemLabel(item)} up`}
                      hitSlop={8}
                    >
                      <IconSymbol name="chevron.up" size={20} color={index === 0 ? '#4a4540' : '#c9b97a'} />
                    </IconButton>
                    <IconButton
                      onPress={() => moveItem(index, 1)}
                      disabled={index === playlist.length - 1}
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${itemLabel(item)} down`}
                      hitSlop={8}
                    >
                      <IconSymbol name="chevron.down" size={20} color={index === playlist.length - 1 ? '#4a4540' : '#c9b97a'} />
                    </IconButton>
                    <IconButton
                      onPress={() => handleRemoveItem(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${itemLabel(item)}`}
                      hitSlop={8}
                    >
                      <IconSymbol name="xmark" size={14} color="#8a7e6e" />
                    </IconButton>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
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
  headerTitleInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#f0ead6',
    textAlign: 'center',
  },
  loading: {
    marginTop: 60,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f0ead6',
    fontSize: 15,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#c9b97a',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionLabelInRow: {
    marginTop: 0,
    marginBottom: 0,
  },
  sectionHint: {
    fontSize: 11,
    color: '#6a6050',
    fontStyle: 'italic',
  },
  choosePersonalTrackButton: {
    marginTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackChipPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    color: '#a89f88',
  },
  chipTextSelected: {
    color: '#f0ead6',
    fontWeight: '600',
  },
  emptyPlaylistText: {
    fontSize: 13,
    color: '#6a6050',
  },
  playlistList: {
    gap: 8,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a4540',
    gap: 10,
  },
  playlistRowName: {
    flex: 1,
    fontSize: 14,
    color: '#f0ead6',
  },
  playlistRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
});
