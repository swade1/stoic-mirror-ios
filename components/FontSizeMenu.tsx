import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ScaledText } from '@/components/ScaledText';
import { useFontScale } from '@/contexts/FontScaleContext';
import { FONT_SCALE_STEPS } from '@/lib/fontScale';

interface FontSizeMenuProps {
  visible: boolean;
  onClose: () => void;
  // Absolute top position for the card, computed per-screen from that
  // screen's own safe-area inset + header height, so it drops from
  // roughly where the trigger icon sits in that screen's header.
  anchorTop: number;
}

// Second entry point for the same font-size preference already
// controlled from Settings > Text Size — this is the in-context version
// reading-focused apps (Kindle, Apple Books, Safari Reader) use instead,
// surfaced right where the text it affects is visible.
export function FontSizeMenu({ visible, onClose, anchorTop }: FontSizeMenuProps) {
  const { fontScale, setFontScale } = useFontScale();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close text size menu"
      >
        <Pressable style={[styles.card, { top: anchorTop }]} onPress={() => {}}>
          <Text style={styles.label}>Text Size</Text>
          <ScaledText style={styles.preview}>Aa</ScaledText>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    position: 'absolute',
    right: 20,
    width: 200,
    backgroundColor: '#1e1c18',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4a4540',
    padding: 16,
  },
  label: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  preview: {
    fontSize: 24,
    color: '#f0ead6',
    textAlign: 'center',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#4a4540',
    marginBottom: 8,
  },
  optionSelected: {
    borderColor: '#c9b97a',
    backgroundColor: '#2a2720',
  },
  optionText: {
    fontSize: 14,
    color: '#a89f88',
  },
  optionTextSelected: {
    color: '#f0ead6',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 14,
    color: '#c9b97a',
    fontWeight: 'bold',
  },
});
