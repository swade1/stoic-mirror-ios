import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const nextPath = `/onboarding1`;
const loginPath = `/login`;

export default function Start() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.flexGrow} />

      <Image
       source={require('../assets/images/wreath-welcome.png')}
       style={styles.wreathImage}
     />
      <Text style={styles.title}>The Stoic Mirror</Text>
      <Text style={styles.subtitle}>Ancient wisdom for modern concerns</Text>
      <Text style={styles.attribution}>
        Marcus Aurelius · Epictetus · Seneca 
      </Text>

      <View style={styles.flexGrow} />

      <TouchableOpacity style={styles.button} onPress={() => router.push(nextPath)}>
        <Text style={styles.buttonText}>Begin</Text>
      </TouchableOpacity>

      <Pressable onPress={() => router.push(loginPath)}>
        <Text style={styles.signInText}>or Sign In here</Text>
      </Pressable>

      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0f0e0c',
  },
  spacer: { height: 40 },
  wreathImage: {
    width: 160,
    height: 160,
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#f0ead6',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 18,
    color: '#c4b99e',
    marginBottom: 12,
    textAlign: 'center',
  },
  attribution: {
    fontSize: 12,
    color: '#8a7e6e',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 32,
  },
  flexGrow: { flex: 1 },
  button: {
    backgroundColor: '#2a2720',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 20,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#c9b97a',
  },
  buttonText: {
    color: '#c9b97a',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
  signInText: {
    color: '#8a7e6e',
    fontSize: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginBottom: 24,
  },
});
