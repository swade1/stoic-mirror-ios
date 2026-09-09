import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { CONCERN_OPTIONS } from '@/lib/concerns';

const REASONS = CONCERN_OPTIONS;

export default function ConcernsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadConcerns = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data } = await supabase
        .from('profiles')
        .select('concerns')
        .eq('id', session.user.id)
        .single();

      if (data?.concerns) setSelected(data.concerns);
      setLoading(false);
    };
    loadConcerns();
  }, []);

  const toggle = (reason: string) => {
    setSelected((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const handleSave = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.back(); return; }

    setSaving(true);
    await supabase
      .from('profiles')
      .update({ concerns: selected })
      .eq('id', session.user.id);
    setSaving(false);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Settings"
        >
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your concerns</Text>
        <Text style={styles.headerSubtitle}>
          This shapes the counsel you receive. Select as many as apply.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#c9b97a" style={{ marginTop: 60 }} />
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.options}>
              {REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.option, selected.includes(reason) && styles.optionSelected]}
                  onPress={() => toggle(reason)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected.includes(reason) }}
                >
                  <Text style={[styles.optionText, selected.includes(reason) && styles.optionTextSelected]}>
                    {reason}
                  </Text>
                  {selected.includes(reason) && <Text style={styles.checkmark} importantForAccessibility="no">✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </>
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4540',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  backText: {
    fontSize: 14,
    color: '#c9b97a',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f0ead6',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8a7e6e',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  options: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  optionSelected: {
    borderColor: '#c9b97a',
    backgroundColor: '#2a2720',
  },
  optionText: {
    fontSize: 16,
    color: '#a89f88',
  },
  optionTextSelected: {
    color: '#f0ead6',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#c9b97a',
    fontWeight: 'bold',
  },
  footer: {
    padding: 24,
    paddingTop: 0,
  },
  button: {
    backgroundColor: '#2a2720',
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c9b97a',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#c9b97a',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
});
