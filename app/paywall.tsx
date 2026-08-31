import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      
      <View style={styles.content}>
        <IconSymbol name="lock.fill" size={48} color="#c9b97a" style={styles.icon} />
        
        <Text style={styles.headline}>You've sought counsel 3 times.</Text>
        <Text style={styles.subheadline}>The philosophers have more to say.</Text>
        
        <Text style={styles.body}>
          You've experienced what The Stoic Mirror can do. Unlock unlimited wisdom and continue your practice.
        </Text>

        <View style={styles.plans}>
          <TouchableOpacity style={styles.planButton}>
            <Text style={styles.planTitle}>Monthly</Text>
            <Text style={styles.planPrice}>$4.99/month</Text>
            <Text style={styles.planTrial}>7 days free</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.planButton, styles.planButtonFeatured]}>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>BEST VALUE</Text>
            </View>
            <Text style={[styles.planTitle, styles.planTitleFeatured]}>Annual</Text>
            <Text style={[styles.planPrice, styles.planPriceFeatured]}>$39.99/year</Text>
            <Text style={[styles.planTrial, styles.planTrialFeatured]}>7 days free · save 33%</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.maybeLater} onPress={() => router.back()}>
          <Text style={styles.maybeLaterText}>Maybe later</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Cancel anytime. Billed through Apple. Subscription auto-renews unless cancelled 24 hours before renewal.
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
  content: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 24,
  },
  headline: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#f0ead6',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subheadline: {
    fontSize: 18,
    color: '#c9b97a',
    textAlign: 'center',
    marginBottom: 24,
  },
  body: {
    fontSize: 15,
    color: '#a89f88',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  plans: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  planButton: {
    backgroundColor: '#1e1c18',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  planButtonFeatured: {
    borderColor: '#c9b97a',
    borderWidth: 2,
  },
  planBadge: {
    backgroundColor: '#c9b97a',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f0e0c',
    letterSpacing: 1,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a89f88',
    marginBottom: 4,
  },
  planTitleFeatured: {
    color: '#f0ead6',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f0ead6',
    marginBottom: 4,
  },
  planPriceFeatured: {
    color: '#c9b97a',
  },
  planTrial: {
    fontSize: 13,
    color: '#5a5446',
  },
  planTrialFeatured: {
    color: '#a89f88',
  },
  maybeLater: {
    marginBottom: 24,
  },
  maybeLaterText: {
    fontSize: 14,
    color: '#5a5446',
    textDecorationLine: 'underline',
  },
  disclaimer: {
    fontSize: 11,
    color: '#3a3730',
    textAlign: 'center',
    lineHeight: 16,
  },
});
