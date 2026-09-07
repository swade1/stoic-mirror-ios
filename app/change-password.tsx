import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing information', 'Please fill in all three fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user.email) {
      setSaving(false);
      Alert.alert('Error', 'Could not verify your account. Please sign in again.');
      return;
    }

    // Verify the current password by re-authenticating before allowing a change
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });
    if (verifyError) {
      setSaving(false);
      Alert.alert('Incorrect password', 'Your current password is incorrect.');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (updateError) {
      Alert.alert('Error', updateError.message);
      return;
    }

    Alert.alert('Password updated', 'Your password has been changed.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Settings"
        >
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <Text style={styles.headerSubtitle}>
          Enter your current password, then choose a new one.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Current Password</Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="your current password"
            placeholderTextColor="#8a7e6e"
            secureTextEntry={!showCurrent}
            textContentType="password"
            autoComplete="off"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            accessibilityLabel="Current password"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowCurrent((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={showCurrent ? 'Hide password' : 'Show password'}
          >
            <IconSymbol name={showCurrent ? 'eye.slash' : 'eye'} size={18} color="#8a7e6e" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>New Password</Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="choose a new password"
            placeholderTextColor="#8a7e6e"
            secureTextEntry={!showNew}
            textContentType="newPassword"
            autoComplete="off"
            value={newPassword}
            onChangeText={setNewPassword}
            accessibilityLabel="New password"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowNew((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={showNew ? 'Hide password' : 'Show password'}
          >
            <IconSymbol name={showNew ? 'eye.slash' : 'eye'} size={18} color="#8a7e6e" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Confirm New Password</Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="confirm your new password"
            placeholderTextColor="#8a7e6e"
            secureTextEntry={!showConfirm}
            textContentType="newPassword"
            autoComplete="off"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            accessibilityLabel="Confirm new password"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowConfirm((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
          >
            <IconSymbol name={showConfirm ? 'eye.slash' : 'eye'} size={18} color="#8a7e6e" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
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
    fontSize: 13,
    color: '#8a7e6e',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  label: {
    fontSize: 13,
    color: '#c4b99e',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1e1c18',
    borderWidth: 1,
    borderColor: '#6a6050',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f0ead6',
    fontSize: 16,
    marginBottom: 20,
  },
  passwordWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#2a2720',
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c9b97a',
    marginTop: 8,
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
