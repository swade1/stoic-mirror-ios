import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { listSoundtracksWithCounts, createSoundtrack, renameSoundtrack, deleteSoundtrack, type Soundtrack } from '@/lib/soundtracks';

// Doubles as two screens in one, distinguished by whether pickForCollectionId
// is present:
//  - Reached from a slideshow's "Soundtrack" row (app/slideshow-photos.tsx):
//    pickForCollectionId is set, tapping a row assigns that soundtrack to
//    the slideshow and pops back — this is the reusable-soundtrack picker.
//  - Reached on its own (no param): a plain library, tapping a row opens
//    the editor to tweak it directly.
// Structurally modeled on app/slideshow-collections.tsx — same
// list-plus-bottom-panel create/rename pattern, applied to soundtracks
// instead of slideshow collections. The pencil icon means the same thing
// it does there — rename only — in both modes; opening the full editor
// (mood/tracks/playlist) is a separate action (row tap when browsing, or
// the gear icon when picking, since picking repurposes the row tap for
// assignment).
export default function SoundtracksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pickForCollectionId } = useLocalSearchParams<{ pickForCollectionId?: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [soundtracks, setSoundtracks] = useState<Soundtrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setUserId(null);
      setSoundtracks([]);
      setLoading(false);
      return;
    }
    setUserId(session.user.id);
    setSoundtracks(await listSoundtracksWithCounts(session.user.id).catch(() => []));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const assignAndReturn = async (soundtrackId: string | null) => {
    if (!pickForCollectionId) return;
    await supabase.from('slideshow_collections').update({ soundtrack_id: soundtrackId }).eq('id', pickForCollectionId);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: '/slideshow-photos', params: { collectionId: pickForCollectionId } });
    }
  };

  const selectRow = (soundtrack: Soundtrack) => {
    if (pickForCollectionId) {
      assignAndReturn(soundtrack.id);
    } else {
      router.push({ pathname: '/soundtrack-edit', params: { soundtrackId: soundtrack.id } });
    }
  };

  const openNewSoundtrackPanel = () => {
    setIsCreating(true);
    setEditingId(null);
    setNameDraft('');
  };

  const openRenamePanel = (soundtrack: Soundtrack) => {
    setIsCreating(false);
    setEditingId(soundtrack.id);
    setNameDraft(soundtrack.name);
  };

  const closePanel = () => {
    setIsCreating(false);
    setEditingId(null);
    setNameDraft('');
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) return;
    setSaving(true);
    try {
      if (isCreating) {
        if (!userId) return;
        const newId = await createSoundtrack(userId, trimmed);
        closePanel();
        // A brand new soundtrack has no tracks yet — go straight into the
        // editor so the user can start adding some. It's deliberately NOT
        // auto-assigned to pickForCollectionId here even when reached as
        // a picker — assignment should only ever happen from an explicit
        // tap on a soundtrack in the list, never as a side effect of
        // creating one, so backing out of the editor lands back on the
        // picker with the new soundtrack available to choose (or not).
        router.push({ pathname: '/soundtrack-edit', params: { soundtrackId: newId } });
      } else if (editingId) {
        await renameSoundtrack(editingId, trimmed);
        closePanel();
        await load();
      }
    } catch (err) {
      Alert.alert('Save Failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (soundtrack: Soundtrack) => {
    Alert.alert(
      'Delete Soundtrack',
      `Delete "${soundtrack.name}"? Any slideshow currently using it will be left with no soundtrack.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSoundtracks((prev) => prev.filter((s) => s.id !== soundtrack.id));
            try {
              await deleteSoundtrack(soundtrack.id);
            } catch (err) {
              await load();
              Alert.alert('Delete Failed', err instanceof Error ? err.message : 'Something went wrong.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/slideshow-collections'))}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pickForCollectionId ? 'Choose Soundtrack' : 'Soundtracks'}</Text>
        <TouchableOpacity onPress={openNewSoundtrackPanel} accessibilityRole="button" accessibilityLabel="New soundtrack">
          <IconSymbol name="plus" size={20} color="#c9b97a" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color="#c9b97a" />
      ) : (
        <FlatList
          data={soundtracks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            pickForCollectionId ? (
              <TouchableOpacity
                style={styles.row}
                onPress={() => assignAndReturn(null)}
                accessibilityRole="button"
                accessibilityLabel="No soundtrack"
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>None</Text>
                </View>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="music.note" size={40} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
              <Text style={styles.emptyTitle}>No soundtracks yet</Text>
              <Text style={styles.emptySubtitle}>
                Create a soundtrack to build a reusable set of tracks you can assign to any slideshow.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => selectRow(item)}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${item.name}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>
                  {item.trackCount} track{item.trackCount === 1 ? '' : 's'}
                  {'  ·  '}
                  {item.usedByNames.length > 0 ? `Used by ${item.usedByNames.join(', ')}` : 'Not used by any slideshow'}
                </Text>
              </View>
              {pickForCollectionId && (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/soundtrack-edit', params: { soundtrackId: item.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}'s tracks`}
                  hitSlop={8}
                  style={styles.rowAction}
                >
                  <IconSymbol name="gearshape" size={16} color="#a89f88" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => openRenamePanel(item)}
                accessibilityRole="button"
                accessibilityLabel={`Rename ${item.name}`}
                hitSlop={8}
                style={styles.rowAction}
              >
                <IconSymbol name="square.and.pencil" size={16} color="#a89f88" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDelete(item)}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.name}`}
                hitSlop={8}
                style={styles.rowAction}
              >
                <IconSymbol name="xmark.circle.fill" size={16} color="#a89f88" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {(isCreating || editingId !== null) && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.panelWrapper}
          pointerEvents="box-none"
        >
          <View style={[styles.panel, { marginBottom: insets.bottom + 24 }]}>
            <Text style={styles.panelLabel}>{isCreating ? 'New Soundtrack' : 'Rename Soundtrack'}</Text>
            <TextInput
              style={styles.panelInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
              placeholder="Soundtrack name"
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
