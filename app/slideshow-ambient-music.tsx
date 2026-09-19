import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { listAmbientTracks, getTrackMoods, type AmbientTrack, type TrackLength } from '@/lib/ambientTracks';

type AmbientVolume = 'low' | 'medium' | 'high';

const VOLUME_OPTIONS: { label: string; value: AmbientVolume }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

// Always shown, regardless of which lengths currently have tracks — unlike
// mood (which only shows categories actually present), length is a fixed,
// known taxonomy that's being populated incrementally, so the filter
// shouldn't blink chips in and out as tracks are added bucket by bucket.
const TRACK_LENGTH_OPTIONS: TrackLength[] = ['short', 'medium', 'long'];

// Its own screen rather than an inline section of slideshow-photos's
// settings panel — a flat chip list stopped being browsable once mood and
// length filtering were both added on top of a growing track count,
// mirroring how every comparable app (Aura, Insight Timer, Gabby) gives
// music/sound selection a dedicated screen rather than folding it into a
// general settings panel.
export default function SlideshowAmbientMusicScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<AmbientTrack[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedLength, setSelectedLength] = useState<TrackLength | null>(null);
  const [ambientTrackId, setAmbientTrackId] = useState<string | null>(null);
  const [ambientVolume, setAmbientVolume] = useState<AmbientVolume>('medium');

  const load = useCallback(async () => {
    if (!collectionId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: collectionRow }, tracksResult] = await Promise.all([
      supabase
        .from('slideshow_collections')
        .select('ambient_track_id, ambient_volume')
        .eq('id', collectionId)
        .single(),
      listAmbientTracks().catch(() => [] as AmbientTrack[]),
    ]);

    setTracks(tracksResult);
    if (collectionRow) {
      setAmbientTrackId(collectionRow.ambient_track_id ?? null);
      setAmbientVolume(collectionRow.ambient_volume === 'low' || collectionRow.ambient_volume === 'high' ? collectionRow.ambient_volume : 'medium');
    }
    setLoading(false);
  }, [collectionId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
  const filteredTracks = tracks.filter(
    (track) => (selectedMood === null || track.mood === selectedMood) &&
      (selectedLength === null || track.length === selectedLength)
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to slideshow settings"
        >
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ambient Music</Text>
        <View style={{ width: 16 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color="#c9b97a" />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
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

          <Text style={styles.sectionLabel}>Length</Text>
          <View style={styles.chipRow}>
            {(['all', ...TRACK_LENGTH_OPTIONS] as const).map((length) => {
              const value = length === 'all' ? null : length;
              const selected = selectedLength === value;
              const label = length === 'all' ? 'All' : length.charAt(0).toUpperCase() + length.slice(1);
              return (
                <TouchableOpacity
                  key={length}
                  onPress={() => setSelectedLength(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Filter ambient music by length: ${label}`}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Track</Text>
          <View style={styles.chipRow}>
            {selectedMood === null && selectedLength === null && (
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
              <Text style={styles.sectionLabel}>Volume</Text>
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f0ead6',
  },
  loading: {
    marginTop: 60,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
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
  chipText: {
    fontSize: 13,
    color: '#a89f88',
  },
  chipTextSelected: {
    color: '#f0ead6',
    fontWeight: '600',
  },
});
