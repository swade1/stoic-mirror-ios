import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { IconButton } from '@/components/ui/IconButton';

interface SlideshowCollection {
  id: string;
  name: string;
  sortOrder: number;
  photoCount: number;
  thumbnailUri: string | null;
}

export default function SlideshowCollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [collections, setCollections] = useState<SlideshowCollection[]>([]);
  const [loading, setLoading] = useState(true);
  // null = panel closed; a string (possibly empty, for a new collection) =
  // panel open, editing that collection's name; the sentinel 'new' id-less
  // case is handled by editingId being null while the panel is open.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setCollections([]);
      setLoading(false);
      return;
    }

    const [{ data: collectionRows, error }, { data: photoRows }] = await Promise.all([
      supabase
        .from('slideshow_collections')
        .select('id, name, sort_order')
        .eq('user_id', session.user.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('slideshow_photos')
        .select('collection_id, asset_id, sort_order')
        .eq('user_id', session.user.id)
        .order('sort_order', { ascending: true }),
    ]);

    if (error || !collectionRows) {
      setCollections([]);
      setLoading(false);
      return;
    }

    // Grouped client-side from one query rather than one query per
    // collection — the photo list is already scoped to this user and
    // small enough that this is cheap.
    const photosByCollection = new Map<string, { asset_id: string }[]>();
    (photoRows ?? []).forEach((row) => {
      if (!row.collection_id) return;
      const list = photosByCollection.get(row.collection_id) ?? [];
      list.push(row);
      photosByCollection.set(row.collection_id, list);
    });

    const resolved = await Promise.all(
      collectionRows.map(async (row) => {
        const photos = photosByCollection.get(row.id) ?? [];
        let thumbnailUri: string | null = null;
        if (photos.length > 0) {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(photos[0].asset_id);
            thumbnailUri = info?.localUri ?? info?.uri ?? null;
          } catch {
            thumbnailUri = null;
          }
        }
        return {
          id: row.id,
          name: row.name,
          sortOrder: row.sort_order,
          photoCount: photos.length,
          thumbnailUri,
        };
      })
    );

    setCollections(resolved);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNewCollectionPanel = () => {
    setEditingId(null);
    setIsCreating(true);
    setNameDraft('');
  };

  const openRenamePanel = (collection: SlideshowCollection) => {
    setEditingId(collection.id);
    setIsCreating(false);
    setNameDraft(collection.name);
  };

  const closePanel = () => {
    setEditingId(null);
    setIsCreating(false);
    setNameDraft('');
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (isCreating) {
        const nextOrder = collections.length > 0 ? Math.max(...collections.map((c) => c.sortOrder)) + 1 : 0;
        const { error } = await supabase
          .from('slideshow_collections')
          .insert({ user_id: session.user.id, name: trimmed, sort_order: nextOrder });
        if (error) throw error;
      } else if (editingId) {
        const { error } = await supabase
          .from('slideshow_collections')
          .update({ name: trimmed })
          .eq('id', editingId);
        if (error) throw error;
      }
      closePanel();
      await load();
    } catch (err) {
      Alert.alert('Save Failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCollection = (collection: SlideshowCollection) => {
    Alert.alert(
      'Delete Collection',
      `Delete "${collection.name}"? This removes it from your slideshow list — the photos stay in your Photos library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setCollections((prev) => prev.filter((c) => c.id !== collection.id));
            // A collection's assigned soundtrack is a standalone object
            // that may be reused by other slideshows, so deleting a
            // collection must never touch it — only slideshow_photos
            // cascades from this delete.
            const { error } = await supabase.from('slideshow_collections').delete().eq('id', collection.id);
            if (error) {
              await load();
              Alert.alert('Delete Failed', error.message);
            }
          },
        },
      ]
    );
  };

  const panelOpen = isCreating || editingId !== null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to History"
        >
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
        </IconButton>
        <Text style={styles.headerTitle}>Slideshows</Text>
        <View style={styles.headerActions}>
          <IconButton
            onPress={() => router.push('/soundtracks')}
            accessibilityRole="button"
            accessibilityLabel="Manage soundtracks"
            hitSlop={8}
          >
            <IconSymbol name="music.note.list" size={20} color="#c9b97a" />
          </IconButton>
          <IconButton
            onPress={openNewCollectionPanel}
            accessibilityRole="button"
            accessibilityLabel="New collection"
            hitSlop={8}
          >
            <IconSymbol name="plus" size={20} color="#c9b97a" />
          </IconButton>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color="#c9b97a" />
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="photo.on.rectangle" size={40} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
              <Text style={styles.emptyTitle}>No slideshows yet</Text>
              <Text style={styles.emptySubtitle}>
                Create a collection to group your saved quote cards into a themed, rotating slideshow.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push({ pathname: '/slideshow-photos', params: { collectionId: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Manage ${item.name}`}
            >
              <View style={styles.thumbnail}>
                {item.thumbnailUri ? (
                  <Image source={{ uri: item.thumbnailUri }} style={styles.thumbnailImage} contentFit="cover" />
                ) : (
                  <IconSymbol name="photo.on.rectangle" size={20} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
                )}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>{item.photoCount} photo{item.photoCount === 1 ? '' : 's'}</Text>
              </View>
              <IconButton
                onPress={() => openRenamePanel(item)}
                accessibilityRole="button"
                accessibilityLabel={`Rename ${item.name}`}
                hitSlop={8}
                style={styles.rowAction}
              >
                <IconSymbol name="square.and.pencil" size={16} color="#a89f88" />
              </IconButton>
              <IconButton
                onPress={() =>
                  router.push({ pathname: '/slideshow-play', params: { collectionId: item.id } })
                }
                disabled={item.photoCount === 0}
                accessibilityRole="button"
                accessibilityLabel={`Play ${item.name}`}
                hitSlop={8}
                style={styles.rowAction}
              >
                <IconSymbol name="play.rectangle" size={18} color={item.photoCount === 0 ? '#4a4540' : '#c9b97a'} />
              </IconButton>
              <IconButton
                onPress={() => deleteCollection(item)}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.name}`}
                hitSlop={8}
                style={styles.rowAction}
              >
                <IconSymbol name="xmark.circle.fill" size={16} color="#a89f88" />
              </IconButton>
            </TouchableOpacity>
          )}
        />
      )}

      {panelOpen && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.panelWrapper}
          pointerEvents="box-none"
        >
          <View style={[styles.panel, { marginBottom: insets.bottom + 24 }]}>
            <Text style={styles.panelLabel}>{isCreating ? 'New Slideshow' : 'Rename Slideshow'}</Text>
            <TextInput
              style={styles.panelInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
              placeholder="Slideshow name"
              placeholderTextColor="#6a6050"
            />
            <View style={styles.panelActions}>
              <TouchableOpacity onPress={closePanel} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={styles.panelCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveName}
                disabled={saving || nameDraft.trim().length === 0}
                accessibilityRole="button"
                accessibilityLabel="Save"
              >
                <Text style={[styles.panelSaveText, (saving || nameDraft.trim().length === 0) && styles.panelSaveTextDisabled]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  loading: {
    marginTop: 60,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e1c18',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a4540',
    padding: 12,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0f0e0c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f0ead6',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#8a7e6e',
  },
  rowAction: {
    padding: 4,
  },
  panelWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  panel: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(15,14,12,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4a4540',
    padding: 16,
    gap: 10,
  },
  panelLabel: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  panelInput: {
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: 4,
    color: '#f0ead6',
  },
  panelActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelCancelText: {
    fontSize: 14,
    color: '#a89f88',
  },
  panelSaveText: {
    fontSize: 14,
    color: '#c9b97a',
    fontWeight: '600',
  },
  panelSaveTextDisabled: {
    color: '#4a4540',
  },
});
