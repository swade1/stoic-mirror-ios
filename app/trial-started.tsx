import { useRouter, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function TrialStartedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plan, trialEnd } = useLocalSearchParams<{ plan?: string; trialEnd?: string }>();

  const isMonthly = plan === 'monthly';
  const trialEndDate = trialEnd ? new Date(trialEnd) : new Date();
  const trialEndString = trialEndDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require('../assets/images/mirror-welcome.png')}
          style={styles.mirrorImage}
        />

        <View style={styles.iconBadge}>
          <IconSymbol name="checkmark.circle.fill" size={28} color="#c9b97a" />
        </View>

        <Text style={styles.headline}>You&apos;re all set.</Text>
        <Text style={styles.subheadline}>
          Your 7-day free trial has started. Take your time — the practice is yours to explore.
        </Text>

        <View style={styles.timeline}>
          <View style={styles.timelineStep}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineText}>
              <Text style={styles.timelineTitle}>Today — Full access unlocked</Text>
              <Text style={styles.timelineSubtitle}>No charge, cancel anytime</Text>
            </View>
          </View>
          <View style={styles.timelineLine} />
          <View style={styles.timelineStep}>
            <View style={[styles.timelineDot, styles.timelineDotMuted]} />
            <View style={styles.timelineText}>
              <Text style={styles.timelineTitle}>{trialEndString} — Trial ends</Text>
              <Text style={styles.timelineSubtitle}>
                {isMonthly ? '$4.99/month' : '$39.99/year'} begins, unless you cancel first
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.reassurance}>
          You can cancel from Settings any time before {trialEndString} and you won&apos;t be
          charged — no questions asked.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.buttonText}>Begin your practice</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
  },
  scrollContent: {
    padding: 32,
    paddingTop: 40,
    alignItems: 'center',
  },
  mirrorImage: {
    width: 88,
    height: 88,
    marginBottom: 16,
  },
  iconBadge: {
    marginBottom: 16,
  },
  headline: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f0ead6',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  subheadline: {
    fontSize: 16,
    color: '#a89f88',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  timeline: {
    width: '100%',
    backgroundColor: '#1e1c18',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#c9b97a',
    marginTop: 4,
  },
  timelineDotMuted: {
    backgroundColor: '#4a4540',
  },
  timelineLine: {
    width: 2,
    height: 20,
    backgroundColor: '#4a4540',
    marginLeft: 5,
    marginVertical: 4,
  },
  timelineText: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f0ead6',
    marginBottom: 2,
  },
  timelineSubtitle: {
    fontSize: 12,
    color: '#8a7e6e',
  },
  reassurance: {
    fontSize: 13,
    color: '#8a7e6e',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#c9b97a',
    borderRadius: 20,
    paddingVertical: 16,
    width: '100%',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f0e0c',
    textAlign: 'center',
    letterSpacing: 1,
  },
});
