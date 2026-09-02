import { useRouter } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/ui/IconSymbol';

const PLAN_DESCRIPTIONS: Record<string, string> = {
  'Anxiety & worry': 'The Stoics were masters of anxiety. Your practice will focus on separating what you can control from what you cannot — the foundation of Stoic calm.',
  'Relationships & conflict': 'The Stoics taught that we cannot control others, only our response to them. Your practice will help you find clarity and equanimity in difficult relationships.',
  'Work & career stress': 'Marcus Aurelius ran an empire under constant pressure. Your practice will draw on his strategies for maintaining focus and purpose under stress.',
  'Loss & grief': 'Seneca wrote more about loss than any other Stoic. Your practice will help you find meaning and acceptance through his most compassionate counsel.',
  'Finding direction': 'Epictetus taught that clarity comes from knowing what is truly yours to decide. Your practice will help you find your path through Stoic self-examination.',
  'General peace of mind': 'The Stoics had one goal: equanimity. A quiet, unshakeable calm that no circumstance can touch. Your practice begins here.',
};

const DEFAULT_DESCRIPTION = 'The Stoics had one goal: equanimity. A quiet, unshakeable calm that no circumstance can touch. Your practice begins here.';

const FEATURES = [
  {
    icon: 'text.bubble.fill',
    title: 'Daily reflection',
    subtitle: 'A new Stoic quote every morning',
  },
  {
    icon: 'bubble.left.and.bubble.right.fill',
    title: 'Unlimited counsel',
    subtitle: 'Describe any concern, receive wisdom',
  },
  {
    icon: 'books.vertical.fill',
    title: 'Your wisdom library',
    subtitle: 'Save and revisit what resonates',
  },
];

export default function Onboarding3() {
  const router = useRouter();
  const [concerns, setConcerns] = React.useState<string[]>([]);

  React.useEffect(() => {
    const loadConcerns = async () => {
      const stored = await AsyncStorage.getItem('user_primary_concern');
      if (stored) {
        setConcerns(JSON.parse(stored));
      }
    };
    loadConcerns();
  }, []);

  const description = concerns.length > 1
    ? 'You\'ve come with a lot on your mind. Your practice will draw on the full wisdom of Marcus Aurelius, Epictetus, and Seneca to help you find clarity across everything that troubles you.'
    : concerns.length === 1
    ? PLAN_DESCRIPTIONS[concerns[0]] ?? DEFAULT_DESCRIPTION
    : DEFAULT_DESCRIPTION;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <Image
          source={require('../assets/images/mirror-welcome.png')}
          style={styles.mirrorImage}
        />

        <Text style={styles.title}>Your practice, personalized.</Text>

        <View style={styles.descriptionBox}>
          <Text style={styles.description}>{description}</Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <IconSymbol name={feature.icon as any} size={20} color="#c9b97a" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.progressRow}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/paywall')}
        >
          <Text style={styles.buttonText}>See my plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skip} onPress={() => router.push('/signup')}>
          <Text style={styles.skipText}>Skip — try 3 sessions free</Text>
        </TouchableOpacity>
        <View style={styles.spacer} />
      </View>
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
    paddingTop: 60,
    alignItems: 'center',
  },
  mirrorImage: {
    width: 120,
    height: 120,
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#f0ead6',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 24,
    lineHeight: 44,
  },
  descriptionBox: {
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#4a4540',
    borderLeftWidth: 3,
    borderLeftColor: '#c9b97a',
    width: '100%',
  },
  description: {
    fontSize: 16,
    color: '#c4b99e',
    lineHeight: 26,
    textAlign: 'left',
  },
  features: {
    width: '100%',
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2720',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f0ead6',
    marginBottom: 2,
  },
  featureSubtitle: {
    fontSize: 13,
    color: '#8a7e6e',
  },
  footer: {
    padding: 24,
    paddingBottom: 0,
    alignItems: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6a6050',
  },
  dotActive: {
    backgroundColor: '#c9b97a',
  },
  button: {
    backgroundColor: '#2a2720',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#c9b97a',
  },
  buttonText: {
    color: '#c9b97a',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
  skip: {
    marginTop: 16,
  },
  skipText: {
    fontSize: 14,
    color: '#5a5446',
    textDecorationLine: 'underline',
  },
  spacer: { height: 40 },
});
