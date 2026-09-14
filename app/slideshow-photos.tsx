import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface SlideshowPhoto {
  id: string;
  assetId: string;
  sortOrder: number;
  uri: string;
}

const COLUMN_COUNT = 3;

export default function SlideshowPhotosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<SlideshowPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('slideshow_photos')
      .select('id, asset_id, sort_order')
      .eq('user_id', session.user.id)
      .order('sort_order', { ascending: true });

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
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addPhotos = async () => {
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
        asset_id: a.assetId as string,
        sort_order: nextOrder++,
      }));

      // upsert + ignoreDuplicates rather than a plain insert: the table
      // has a unique (user_id, asset_id) constraint, and if the client-
      // side existingIds check above ever misses a case (a stale photos
      // list, a race between two rapid adds), this makes re-adding an
      // already-present photo a harmless no-op instead of a thrown error.
      const { error } = await supabase
        .from('slideshow_photos')
        .upsert(rows, { onConflict: 'user_id,asset_id', ignoreDuplicates: true });
      if (error) throw error;
      await load();
    } catch (err) {
      Alert.alert('Add Failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setAdding(false);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    supabase.from('slideshow_photos').delete().eq('id', id);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to History"
        >
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Slideshow</Text>
        <TouchableOpacity
          onPress={() => router.push('/slideshow-play')}
          disabled={photos.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Play slideshow"
        >
          <IconSymbol name="play.rectangle" size={20} color={photos.length === 0 ? '#4a4540' : '#c9b97a'} />
        </TouchableOpacity>
      </View>

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
