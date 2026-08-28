import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadProfile = async () => {
        setProfileLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) { setProfileLoading(false); return; }

        setEmail(session.user.email ?? null);
        setMemberSince(new Date(session.user.created_at).toLocaleDateString('en-US', {
          month: 'long', year: 'numeric',
        }));

        const { count: entryCount } = await supabase
          .from('entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id);

        const { count: savedCount } = await supabase
          .from('saved_quotes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id);

        if (!cancelled) {
          setTotalEntries(entryCount ?? 0);
          setTotalSaved(savedCount ?? 0);
          setProfileLoading(false);
        }
      };

      loadProfile();
      return () => { cancelled = true; };
    }, [])
  );

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
    router.push('/privacy');
  };

  const handleTerms = () => {
    router.push('/terms');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/images/wreath-small-bright.png')}
          style={styles.wreathSmall}
        />
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {profileLoading ? (
        <ActivityIndicator size="large" color="#c9b97a" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          
          {/* Account */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Account</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.row} onPress={handleSignOut}>
                <Text style={styles.signOutText}>Sign Out</Text>
                <IconSymbol name="chevron.right" size={12} color="#a89f88" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Profile</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowValueEmail}>{email ?? '—'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Member since</Text>
                <Text style={styles.rowValue}>{memberSince ?? '—'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Times counseled</Text>
                <Text style={styles.rowValue}>{totalEntries}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Wisdom saved</Text>
                <Text style={styles.rowValue}>{totalSaved}</Text>
              </View>
            </View>
          </View>

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
                <IconSymbol name="chevron.right" size={12} color="#a89f88" />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} onPress={handleTerms}>
                <Text style={styles.rowLabel}>Terms of Service</Text>
                <IconSymbol name="chevron.right" size={12} color="#a89f88" />
              </TouchableOpacity>
            </View>
          </View>


          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            The Stoic Mirror provides philosophical counsel for reflective purposes only.
            It is not a substitute for professional mental health support.
          </Text>

        </ScrollView>
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
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4540',
  },
  wreathSmall: {
    width: 56,
    height: 56,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f0ead6',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#a89f88',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4a4540',
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
    backgroundColor: '#4a4540',
    marginHorizontal: 16,
  },
  rowLabel: {
    fontSize: 15,
    color: '#c4b99e',
  },
  rowValue: {
    fontSize: 13,
    color: '#a89f88',
    maxWidth: '50%',
    textAlign: 'right',
  },
  rowValueEmail: {
    fontSize: 13,
    color: '#a89f88',
    textAlign: 'right',
    flexShrink: 1,
  },
  signOutText: {
    fontSize: 15,
    color: '#c9b97a',
  },
  disclaimer: {
    fontSize: 12,
    color: '#a89f88',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
