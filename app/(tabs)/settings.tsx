import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://yourdomain.com/privacy');
  };

  const handleTerms = () => {
    Linking.openURL('https://yourdomain.com/terms');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.content}>

        {/* App info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>App</Text>
              <Text style={styles.rowValue}>The Stoic Mirror</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Sources</Text>
              <Text style={styles.rowValue}>Marcus Aurelius · Epictetus · Seneca</Text>
            </View>
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Legal</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={handlePrivacyPolicy}>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
              <IconSymbol name="chevron.right" size={12} color="#8a7e63" />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={handleTerms}>
              <Text style={styles.rowLabel}>Terms of Service</Text>
              <IconSymbol name="chevron.right" size={12} color="#8a7e63" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
              <IconSymbol name="chevron.right" size={12} color="#8a7e63" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          The Stoic Mirror provides philosophical counsel for reflective purposes only.
          It is not a substitute for professional mental health support.
        </Text>

      </View>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2720',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f0ead6',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#8a7e63',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2720',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2720',
    marginHorizontal: 16,
  },
  rowLabel: {
    fontSize: 15,
    color: '#c4b99e',
  },
  rowValue: {
    fontSize: 13,
    color: '#8a7e63',
    maxWidth: '50%',
    textAlign: 'right',
  },
  signOutText: {
    fontSize: 15,
    color: '#c9b97a',
  },
  disclaimer: {
    fontSize: 12,
    color: '#8a7e63',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
