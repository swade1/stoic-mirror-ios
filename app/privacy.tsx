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

export default function PrivacyScreen() {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <Text style={styles.headerSubtitle}>Last updated: August 2026</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Information We Collect">
          We collect the following information when you use The Stoic Mirror:{'\n\n'}
          • <Bold>Account information:</Bold> Your email address and encrypted password when you create an account.{'\n\n'}
          • <Bold>Concerns and journal entries:</Bold> The text you enter when seeking counsel. This content is stored securely and is only accessible to you.{'\n\n'}
          • <Bold>Saved quotes:</Bold> Quotes and interpretations you choose to save to your personal history.{'\n\n'}
          • <Bold>Usage patterns:</Bold> The categories of concerns you explore, used to generate your personal Insights.
        </Section>

        <Section title="How We Use Your Information">
          Your information is used solely to provide and improve The Stoic Mirror experience:{'\n\n'}
          • To authenticate your account and protect your data{'\n'}
          • To process your concerns and return relevant Stoic wisdom{'\n'}
          • To store your journal entries and saved quotes for your personal use{'\n'}
          • To generate your personal Insights showing patterns in your practice{'\n'}
          • To improve the accuracy and relevance of the philosophical counsel provided
        </Section>

        <Section title="Third Party Services">
          The Stoic Mirror uses the following third party services to operate:{'\n\n'}
          • <Bold>Supabase</Bold> — Secure data storage and user authentication.{'\n\n'}
          • <Bold>Anthropic Claude API</Bold> — When you submit a concern, the text is sent to Anthropic's Claude API to generate personalized philosophical interpretations.{'\n\n'}
          • <Bold>Voyage AI</Bold> — Used to match your concerns with relevant Stoic passages.{'\n\n'}
          • <Bold>Expo</Bold> — The framework used to build the app.
        </Section>

        <Section title="Data Security">
          We implement industry-standard security measures to protect your data. All data is 
          transmitted over encrypted HTTPS connections. Your personal concerns are encrypted 
          end-to-end before being stored — we cannot read them, and neither can anyone else. 
          Only you can decrypt your concerns, using your account credentials. Your saved quotes 
          and insights are protected by Row Level Security — only you can access your own data. 
          Passwords are encrypted and never stored in plain text.
        </Section>

        <Section title="Data Retention">
          Your data is retained for as long as your account is active. You may delete your account and all associated data at any time by contacting us. Upon deletion, all your journal entries, saved quotes, and account information will be permanently removed from our systems.
        </Section>

        <Section title="Your Rights">
          You have the right to:{'\n\n'}
          • Access the personal data we hold about you{'\n'}
          • Request correction of inaccurate data{'\n'}
          • Request deletion of your data{'\n'}
          • Export your data in a portable format{'\n'}
          • Withdraw consent at any time by deleting your account
        </Section>

        <Section title="Children's Privacy">
          The Stoic Mirror is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13.
        </Section>

        <Section title="Sensitive Content">
          The Stoic Mirror is designed for personal reflection and philosophical counsel. Users may choose to share sensitive personal concerns within the app. This content is stored securely and is never shared with other users or used for advertising purposes.{'\n\n'}
          The Stoic Mirror is not a substitute for professional mental health support. If you are experiencing a mental health crisis, please contact a qualified professional or emergency services.
        </Section>

        <Section title="Contact Us">
          If you have any questions about this Privacy Policy, please contact us at:{'\n\n'}
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

function Bold({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
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
