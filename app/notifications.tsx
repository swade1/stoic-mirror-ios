import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { requestNotificationPermission, syncNotificationSchedule } from '@/lib/notifications';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date(1970, 0, 1, 8, 0));

  const [reengagementEnabled, setReengagementEnabled] = useState(false);
  const [reengagementDays, setReengagementDays] = useState(3);

  useEffect(() => {
    const loadPrefs = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data } = await supabase
        .from('profiles')
        .select('daily_reminder_enabled, daily_reminder_hour, daily_reminder_minute, reengagement_enabled, reengagement_days')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setDailyEnabled(data.daily_reminder_enabled);
        setReminderTime(new Date(1970, 0, 1, data.daily_reminder_hour, data.daily_reminder_minute));
        setReengagementEnabled(data.reengagement_enabled);
        setReengagementDays(data.reengagement_days);
      }
      setLoading(false);
    };
    loadPrefs();
  }, []);

  const handleSave = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.back(); return; }

    if (dailyEnabled || reengagementEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Notifications disabled',
          'Enable notifications for The Stoic Mirror in your device Settings to receive these reminders. Your preferences will still be saved.'
        );
      }
    }

    setSaving(true);
    await supabase
      .from('profiles')
      .update({
        daily_reminder_enabled: dailyEnabled,
        daily_reminder_hour: reminderTime.getHours(),
        daily_reminder_minute: reminderTime.getMinutes(),
        reengagement_enabled: reengagementEnabled,
        reengagement_days: reengagementDays,
      })
      .eq('id', session.user.id);

    await syncNotificationSchedule();

    setSaving(false);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#c9b97a" style={{ marginTop: 60 }} />
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Daily reminder</Text>
                  <Text style={styles.rowSubtitle}>A short reflection at a time you choose</Text>
                </View>
                <Switch
                  value={dailyEnabled}
                  onValueChange={setDailyEnabled}
                  trackColor={{ false: '#4a4540', true: '#c9b97a' }}
                  thumbColor="#f0ead6"
                />
              </View>
              {dailyEnabled && (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={reminderTime}
                    mode="time"
                    display="spinner"
                    themeVariant="dark"
                    onChange={(_, date) => date && setReminderTime(date)}
                  />
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Remind me if I&apos;m away</Text>
                  <Text style={styles.rowSubtitle}>A gentle nudge after a period of inactivity</Text>
                </View>
                <Switch
                  value={reengagementEnabled}
                  onValueChange={setReengagementEnabled}
                  trackColor={{ false: '#4a4540', true: '#c9b97a' }}
                  thumbColor="#f0ead6"
                />
              </View>
              {reengagementEnabled && (
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setReengagementDays((d) => Math.max(1, d - 1))}
                  >
                    <Text style={styles.stepperButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>
                    {reengagementDays} {reengagementDays === 1 ? 'day' : 'days'}
                  </Text>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setReengagementDays((d) => Math.min(30, d + 1))}
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </>
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
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  section: {
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4a4540',
    padding: 16,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    color: '#f0ead6',
    fontWeight: '600',
    marginBottom: 4,
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#8a7e6e',
  },
  pickerWrap: {
    marginTop: 8,
    alignItems: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c9b97a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: 20,
    color: '#c9b97a',
    fontWeight: 'bold',
  },
  stepperValue: {
    fontSize: 16,
    color: '#f0ead6',
    minWidth: 64,
    textAlign: 'center',
  },
  footer: {
    padding: 24,
    paddingTop: 0,
  },
  button: {
    backgroundColor: '#2a2720',
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c9b97a',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#c9b97a',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
});
