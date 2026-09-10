import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ScaledText } from '@/components/ScaledText';
import { useFontScale } from '@/contexts/FontScaleContext';
import { FONT_SCALE_STEPS } from '@/lib/fontScale';

export default function TextSizeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale, setFontScale } = useFontScale();

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
        <Text style={styles.headerTitle}>Text Size</Text>
        <Text style={styles.headerSubtitle}>
          Adjust the size of quotes, interpretations, and your saved concerns.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Preview</Text>
          <ScaledText style={styles.previewText}>
            &ldquo;You have power over your mind — not outside events. Realize this, and you will find strength.&rdquo;
          </ScaledText>
        </View>

        <View style={styles.options}>
          {FONT_SCALE_STEPS.map((step) => {
            const selected = fontScale === step.value;
            return (
              <TouchableOpacity
                key={step.label}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setFontScale(step.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {step.label}
                </Text>
                {selected && <Text style={styles.checkmark} importantForAccessibility="no">✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
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
  previewBox: {
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2a2720',
    borderLeftWidth: 3,
    borderLeftColor: '#c9b97a',
  },
  previewLabel: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  previewText: {
    fontSize: 16,
    color: '#f0ead6',
    lineHeight: 24,
    fontStyle: 'italic',
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
});
