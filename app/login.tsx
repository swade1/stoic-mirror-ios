import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Error', error.message);
    else router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Continue your Stoic practice
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#8a7e6e"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="your password"
          placeholderTextColor="#8a7e6e"
          secureTextEntry
          textContentType="oneTimeCode"
          autoComplete="off"
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <View style={styles.policyRow}>
          <TouchableOpacity>
            <Text style={styles.policyLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.policySeparator}>·</Text>
          <TouchableOpacity>
            <Text style={styles.policyLink}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={() => router.push('/signup')}>
        <Text style={styles.signUpText}>
          Don't have an account? Create one
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f0ead6',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#c4b99e',
    lineHeight: 24,
  },
  form: {
    marginBottom: 32,
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
  button: {
    backgroundColor: '#2a2720',
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c9b97a',
    marginTop: 8,
    marginBottom: 24,
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
  policyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  policyLink: {
    color: '#8a7e6e',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  policySeparator: {
    color: '#8a7e6e',
  },
  signUpText: {
    color: '#c4b99e',
    fontSize: 15,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
