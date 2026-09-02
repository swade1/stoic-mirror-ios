import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';

const SOCIAL_PROOF = [
  {
    quote: 'The quotes it returns are eerily relevant. It\'s like the philosophers knew exactly what I was going through.',
    initials: 'S.W.',
  },
  {
    quote: 'I open it when I\'m spiraling. It always brings me back.',
    initials: 'D.M.',
  },
];

const FEATURES = [
  { icon: 'bubble.left.and.bubble.right.fill', text: 'Unlimited counsel sessions' },
  { icon: 'books.vertical.fill', text: 'Personal wisdom library' },
  { icon: 'chart.bar.fill', text: 'Insights into your patterns' },
  { icon: 'text.bubble.fill', text: 'Daily Stoic reflection' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = React.useState<'annual' | 'monthly'>('annual');

  // Calculate trial end date
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 7);
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headline}>Support the practice.</Text>
          <Text style={styles.subheadline}>
            Start your 7-day free trial. Cancel anytime.
          </Text>
        </View>

        {/* Trial timeline */}
        <View style={styles.timeline}>
          <View style={styles.timelineStep}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineText}>
              <Text style={styles.timelineTitle}>Today — Free trial begins</Text>
              <Text style={styles.timelineSubtitle}>Full access, no charge</Text>
            </View>
          </View>
          <View style={styles.timelineLine} />
          <View style={styles.timelineStep}>
            <View style={[styles.timelineDot, styles.timelineDotMuted]} />
            <View style={styles.timelineText}>
              <Text style={styles.timelineTitle}>{trialEndString} — Trial ends</Text>
              <Text style={styles.timelineSubtitle}>Cancel before this date for free</Text>
            </View>
          </View>
          <View style={styles.timelineLine} />
          <View style={styles.timelineStep}>
            <View style={[styles.timelineDot, styles.timelineDotMuted]} />
            <View style={styles.timelineText}>
              <Text style={styles.timelineTitle}>Subscription begins</Text>
              <Text style={styles.timelineSubtitle}>
                {selected === 'annual' ? '$39.99/year' : '$4.99/month'} — cancel anytime
              </Text>
            </View>
          </View>
        </View>

        {/* Plans */}
        <View style={styles.plans}>
          <TouchableOpacity
            style={[styles.planButton, selected === 'annual' && styles.planButtonSelected]}
            onPress={() => setSelected('annual')}
          >
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>BEST VALUE</Text>
            </View>
            <View style={styles.planRow}>
              <View style={styles.planLeft}>
                <Text style={[styles.planTitle, selected === 'annual' && styles.planTitleSelected]}>Annual</Text>
                <Text style={styles.planSub}>7 days free · save 33%</Text>
              </View>
              <View style={styles.planRight}>
                <Text style={[styles.planPrice, selected === 'annual' && styles.planPriceSelected]}>$39.99</Text>
                <Text style={styles.planPeriod}>/year</Text>
              </View>
            </View>
            {selected === 'annual' && (
              <View style={styles.selectedCheck}>
                <IconSymbol name="checkmark.circle.fill" size={20} color="#c9b97a" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planButton, selected === 'monthly' && styles.planButtonSelected]}
            onPress={() => setSelected('monthly')}
          >
            <View style={styles.planRow}>
              <View style={styles.planLeft}>
                <Text style={[styles.planTitle, selected === 'monthly' && styles.planTitleSelected]}>Monthly</Text>
                <Text style={styles.planSub}>7 days free</Text>
              </View>
              <View style={styles.planRight}>
                <Text style={[styles.planPrice, selected === 'monthly' && styles.planPriceSelected]}>$4.99</Text>
                <Text style={styles.planPeriod}>/month</Text>
              </View>
            </View>
            {selected === 'monthly' && (
              <View style={styles.selectedCheck}>
                <IconSymbol name="checkmark.circle.fill" size={20} color="#c9b97a" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* CTA Button */}
        <TouchableOpacity style={styles.ctaButton}>
          <Text style={styles.ctaText}>Start free trial</Text>
          <Text style={styles.ctaSubtext}>
            {selected === 'annual'
              ? 'Free until ' + trialEndString + ', then $39.99/year'
              : 'Free until ' + trialEndString + ', then $4.99/month'}
          </Text>
        </TouchableOpacity>

        {/* Social proof */}
        <View style={styles.socialProof}>
          {SOCIAL_PROOF.map((item, index) => (
            <View key={index} style={styles.testimonial}>
              <Text style={styles.testimonialQuote}>"{item.quote}"</Text>
              <Text style={styles.testimonialInitials}>— {item.initials}</Text>
            </View>
          ))}
        </View>

        {/* Features */}
        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.text} style={styles.featureRow}>
              <IconSymbol name={feature.icon as any} size={16} color="#c9b97a" />
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>


        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Cancel anytime before trial ends at no charge. Billed through Apple. 
          Subscription auto-renews unless cancelled 24 hours before renewal date.
        </Text>
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
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  headline: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#f0ead6',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subheadline: {
    fontSize: 16,
    color: '#a89f88',
    textAlign: 'center',
    lineHeight: 24,
  },
  timeline: {
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
  plans: {
    gap: 12,
    marginBottom: 20,
  },
  planButton: {
    backgroundColor: '#1e1c18',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4a4540',
    position: 'relative',
  },
  planButtonSelected: {
    borderColor: '#c9b97a',
    borderWidth: 2,
  },
  planBadge: {
    backgroundColor: '#c9b97a',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f0e0c',
    letterSpacing: 1,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planLeft: {
    flex: 1,
  },
  planRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a89f88',
    marginBottom: 2,
  },
  planTitleSelected: {
    color: '#f0ead6',
  },
  planSub: {
    fontSize: 12,
    color: '#8a7e6e',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f0ead6',
  },
  planPriceSelected: {
    color: '#c9b97a',
  },
  planPeriod: {
    fontSize: 13,
    color: '#8a7e6e',
  },
  selectedCheck: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  ctaButton: {
    backgroundColor: '#c9b97a',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f0e0c',
    marginBottom: 4,
  },
  ctaSubtext: {
    fontSize: 12,
    color: '#2a2720',
  },
  socialProof: {
    gap: 12,
    marginBottom: 24,
  },
  testimonial: {
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4a4540',
    borderLeftWidth: 3,
    borderLeftColor: '#c9b97a',
  },
  testimonialQuote: {
    fontSize: 14,
    color: '#c4b99e',
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  testimonialInitials: {
    fontSize: 12,
    color: '#c9b97a',
    fontWeight: '600',
  },
  features: {
    gap: 12,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#a89f88',
  },
  disclaimer: {
    fontSize: 11,
    color: '#a89f88',
    textAlign: 'center',
    lineHeight: 16,
  },
});
