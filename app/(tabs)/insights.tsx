import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

interface InsightRow {
  category: string;
  entry_count: number;
  last_entry_at: string;
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadInsights = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) { setLoading(false); return; }

        const { data } = await supabase.rpc('get_user_insights');

        if (!cancelled) {
          if (data) {
            setInsights(data);
            setTotal(data.reduce((sum: number, row: InsightRow) => sum + Number(row.entry_count), 0));
          }
          setLoading(false);
        }
      };

      loadInsights();
      return () => { cancelled = true; };
    }, [])
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getBarWidth = (count: number) => {
    const max = insights[0]?.entry_count ?? 1;
    return `${Math.round((count / max) * 100)}%`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/images/mirror-small.png')}
          style={styles.wreathSmall}
        />
        <View>
          <Text style={styles.headerTitle}>Insights</Text>
          <Text style={styles.headerSubtitle}>
            {total} {total === 1 ? 'session' : 'sessions'} across {insights.length} {insights.length === 1 ? 'theme' : 'themes'}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#c9b97a" style={{ marginTop: 60 }} />
      ) : insights.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No insights yet</Text>
          <Text style={styles.emptySubtitle}>
            Seek counsel a few times and your patterns will appear here
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}>

          {/* Summary card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Most explored theme</Text>
            <Text style={styles.summaryValue}>{insights[0]?.category}</Text>
            <Text style={styles.summaryCount}>
              {insights[0]?.entry_count} {Number(insights[0]?.entry_count) === 1 ? 'session' : 'sessions'}
            </Text>
          </View>

          {/* Bar chart */}
          <Text style={styles.sectionLabel}>All themes</Text>
          {insights.map((row) => (
            <View key={row.category} style={styles.barRow}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barCategory}>{row.category}</Text>
                <Text style={styles.barMeta}>
                  {row.entry_count} {Number(row.entry_count) === 1 ? 'session' : 'sessions'} · last {formatDate(row.last_entry_at)}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: getBarWidth(row.entry_count) as any },
                  ]}
                />
              </View>
            </View>
          ))}

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
    width: 68,
    height: 68,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f0ead6',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#a89f88',
    marginTop: 4,
  },
  scrollContent: {
    padding: 24,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6a6050',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6a6050',
    textAlign: 'center',
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: '#1e1c18',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#4a4540',
    borderLeftWidth: 3,
    borderLeftColor: '#c9b97a',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#a89f88',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f0ead6',
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: 13,
    color: '#a89f88',
  },
  sectionLabel: {
    fontSize: 11,
    color: '#a89f88',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  barRow: {
    marginBottom: 20,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  barCategory: {
    fontSize: 14,
    color: '#c4b99e',
    fontWeight: '500',
  },
  barMeta: {
    fontSize: 11,
    color: '#a89f88',
  },
  barTrack: {
    height: 6,
    backgroundColor: '#2a2720',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: '#c9b97a',
    borderRadius: 3,
  },
});
