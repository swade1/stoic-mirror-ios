import React, { useCallback, useEffect, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { IconButton } from '@/components/ui/IconButton';
import { resolveSlideshowAssetUri } from '@/lib/slideshowAssets';
import { hasSeenICloudTip, markICloudTipSeen } from '@/lib/slideshowTip';
import { promptNewSlideshow } from '@/lib/slideshowCreate';
import { showSoundtrackSheet, soundtrackLabel } from '@/lib/soundtrackSheet';

interface SlideshowCollection {
  id: string;
  name: string;
  sortOrder: number;
  photoCount: number;
  thumbnailUri: string | null;
  soundtrackId: string | null;
}

interface SoundtrackOption {
  id: string;
  name: string;
}

export default function SlideshowCollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [collections, setCollections] = useState<SlideshowCollection[]>([]);
  const [loading, setLoading] = useState(true);
  // null = rename panel closed; otherwise the id of the slideshow being
  // renamed. (Creating a new slideshow no longer uses this panel — see
  // startNewSlideshow below.)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [showICloudTip, setShowICloudTip] = useState(false);
  // Fetched once per load alongside collections — reused by every row's
  // soundtrack action sheet rather than re-querying on each tap.
  const [soundtracks, setSoundtracks] = useState<SoundtrackOption[]>([]);

  useEffect(() => {
    hasSeenICloudTip().then((seen) => setShowICloudTip(!seen));
  }, []);

  const dismissICloudTip = () => {
    setShowICloudTip(false);
    markICloudTipSeen();
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setCollections([]);
      setLoading(false);
      return;
    }

    const [{ data: collectionRows, error }, { data: photoRows }, { data: soundtrackRows }] = await Promise.all([
      supabase
        .from('slideshow_collections')
        .select('id, name, sort_order, soundtrack_id')
        .eq('user_id', session.user.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('slideshow_photos')
        .select('collection_id, asset_id, sort_order')
        .eq('user_id', session.user.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('soundtracks')
        .select('id, name')
        .eq('user_id', session.user.id)
        .order('name', { ascending: true }),
    ]);

    setSoundtracks(soundtrackRows ?? []);

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
        const thumbnailUri = photos.length > 0 ? await resolveSlideshowAssetUri(photos[0].asset_id) : null;
        return {
          id: row.id,
          name: row.name,
          sortOrder: row.sort_order,
          photoCount: photos.length,
          thumbnailUri,
          soundtrackId: row.soundtrack_id,
        };
      })
    );

    setCollections(resolved);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Name it, create it, and open it — the slideshow screen then walks the
  // user through adding slides, choosing music and playing.
  const startNewSlideshow = () => {
    promptNewSlideshow((id) =>
      router.push({ pathname: '/slideshow-photos', params: { collectionId: id } })
    );
  };

  const openRenamePanel = (collection: SlideshowCollection) => {
    setEditingId(collection.id);
    setNameDraft(collection.name);
  };

  const closePanel = () => {
    setEditingId(null);
    setNameDraft('');
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (editingId) {
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
      'Delete Slideshow',
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

  // Writes straight through, same shape as slideshow-photos.tsx's
  // chooseDuration/chooseTransition — optimistic local update, then the
  // real write, reverting via a reload if it fails.
  const assignSoundtrack = async (collection: SlideshowCollection, soundtrackId: string | null) => {
    setCollections((prev) => prev.map((c) => (c.id === collection.id ? { ...c, soundtrackId } : c)));
    const { error } = await supabase.from('slideshow_collections').update({ soundtrack_id: soundtrackId }).eq('id', collection.id);
    if (error) {
      await load();
      Alert.alert('Update Failed', error.message);
    }
  };

  const openSoundtrackSheet = (collection: SlideshowCollection) => {
    showSoundtrackSheet({
      slideshowName: collection.name,
      currentId: collection.soundtrackId,
      soundtracks,
      onAssign: (id) => assignSoundtrack(collection, id),
      onManage: (startNew) => router.push({ pathname: '/soundtracks', params: { pickForCollectionId: collection.id, ...(startNew ? { startNew: '1' } : {}) } }),
    });
  };

  const panelOpen = editingId !== null;

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
            onPress={startNewSlideshow}
            accessibilityRole="button"
            accessibilityLabel="New slideshow"
            hitSlop={8}
          >
            <IconSymbol name="plus" size={20} color="#c9b97a" />
          </IconButton>
        </View>
      </View>

      {showICloudTip && !loading && collections.length > 0 && (
        <View style={styles.tipBanner}>
          <IconSymbol name="icloud" size={18} color="#c9b97a" accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.tipBannerText}>
            Tip: keep iCloud Photos on (Settings → Photos) so the photos in your slideshows stay available if you switch to a new phone.
          </Text>
          <IconButton
            onPress={dismissICloudTip}
            accessibilityRole="button"
            accessibilityLabel="Dismiss tip"
            hitSlop={8}
          >
            <IconSymbol name="xmark" size={14} color="#8a7e6e" />
          </IconButton>
        </View>
      )}

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
              <Text style={styles.emptyTitle}>Make your first slideshow</Text>
              <Text style={styles.emptySubtitle}>
                Turn the quotes you&apos;ve saved into cards that play full screen, with calming music.
              </Text>
              <View style={styles.stepsList}>
                <Text style={styles.stepText}>1.  Add slides from your saved quotes</Text>
                <Text style={styles.stepText}>2.  Choose music</Text>
                <Text style={styles.stepText}>3.  Press play</Text>
              </View>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={startNewSlideshow}
                accessibilityRole="button"
                accessibilityLabel="Make a slideshow"
              >
                <Text style={styles.emptyButtonText}>Make a slideshow</Text>
              </TouchableOpacity>
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
                <Text style={styles.rowSubtitle}>
                  {item.photoCount} slide{item.photoCount === 1 ? '' : 's'} · Music: {soundtrackLabel(item.soundtrackId, soundtracks)}
                </Text>
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
                onPress={() => openSoundtrackSheet(item)}
                accessibilityRole="button"
                accessibilityLabel={`Choose music for ${item.name}`}
                hitSlop={8}
                style={styles.rowAction}
              >
                <IconSymbol name="music.note" size={16} color="#a89f88" />
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
            <Text style={styles.panelLabel}>Rename Slideshow</Text>
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
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(201,185,122,0.08)',
    borderWidth: 1,
    borderColor: '#4a4540',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tipBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#a89f88',
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
    color: '#8a7e6e',
    textAlign: 'center',
    lineHeight: 20,
  },
  stepsList: {
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  stepText: {
    fontSize: 15,
    color: '#c4b99e',
  },
  emptyButton: {
    marginTop: 16,
    backgroundColor: '#c9b97a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f0e0c',
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
