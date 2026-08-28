import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <Text style={styles.headerSubtitle}>Last updated: August 2026</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="1. Acceptance of Terms">
          By accessing or using The Stoic Mirror, you agree to these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use the application.
        </Section>

        <Section title="2. Description of Service">
          The Stoic Mirror is a personal reflection application that provides philosophical counsel drawn from the writings of Stoic philosophers including Marcus Aurelius, Epictetus, and Seneca. The app uses artificial intelligence to match your concerns with relevant passages from verified Stoic texts and provide personalized interpretations.
        </Section>

        <Section title="3. Not a Medical or Mental Health Service">
          The Stoic Mirror provides philosophical counsel for personal reflection purposes only. It is not a medical service, mental health service, or substitute for professional psychological or psychiatric treatment.{'\n\n'}
          If you are experiencing a mental health crisis, thoughts of self-harm, or any medical emergency, please contact emergency services or a qualified professional immediately.
        </Section>

        <Section title="4. User Accounts">
          To use The Stoic Mirror you must create an account with a valid email address. You are responsible for:{'\n\n'}
          • Maintaining the confidentiality of your account credentials{'\n'}
          • All activity that occurs under your account{'\n'}
          • Notifying us immediately of any unauthorized use of your account{'\n'}
          • Ensuring your account information is accurate and up to date
        </Section>

        <Section title="5. User Content">
          You retain ownership of the concerns and personal content you enter into The Stoic Mirror. By using the app, you grant us a limited license to process your content for the sole purpose of providing the service.{'\n\n'}
          You agree not to enter content that is illegal, harmful, threatening, or harassing.
        </Section>

        <Section title="6. Intellectual Property">
          The Stoic Mirror app, including its design, features, and original content, is owned by us and protected by applicable intellectual property laws. The Stoic philosophical texts used in the app are in the public domain.
        </Section>

        <Section title="7. Disclaimer of Warranties">
          The Stoic Mirror is provided "as is" without warranties of any kind. We do not warrant that the app will be error-free or uninterrupted, or that the philosophical counsel provided will be accurate or suitable for your particular situation.
        </Section>

        <Section title="8. Limitation of Liability">
          To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of The Stoic Mirror.
        </Section>

        <Section title="9. Termination">
          We reserve the right to suspend or terminate your account if you violate these Terms of Service. You may delete your account at any time through the app's Settings screen.
        </Section>

        <Section title="10. Governing Law">
          These Terms of Service are governed by the laws of the State of New Mexico, United States.
        </Section>

        <Section title="11. Contact Us">
          If you have any questions about these Terms of Service, please contact us at:{'\n\n'}
          susan.wade09@gmail.com
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
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
    fontSize: 12,
    color: '#8a7e6e',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c9b97a',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  sectionBody: {
    fontSize: 15,
    color: '#c4b99e',
    lineHeight: 24,
  },
  bold: {
    fontWeight: '600',
    color: '#f0ead6',
  },
});
