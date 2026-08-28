import { Theme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { supabase } from '@/lib/supabase';

const DarkTheme: Theme = {
  dark: true,
  colors: {
    primary: '#c9b97a',
    background: '#0f0e0c',
    card: '#1e1c18',
    text: '#f0ead6',
    border: '#6a6050',
    notification: '#c9b97a',
  },
  fonts: {
    regular: { fontFamily: 'SpaceMono', fontWeight: '400' },
    medium: { fontFamily: 'SpaceMono', fontWeight: '500' },
    bold: { fontFamily: 'SpaceMono', fontWeight: '700' },
    heavy: { fontFamily: 'SpaceMono', fontWeight: '900' },
  },
};

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setIsSignedIn(!!data.session && !!data.session.user);
    };
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const isAuthenticated = !!session && !!session.user;
      setIsSignedIn(isAuthenticated);
      if (event === 'SIGNED_IN' && isAuthenticated) {
        router.replace('/(tabs)');
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  if (!loaded || isSignedIn === null) {
    return null;
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {isSignedIn ? (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="loading" options={{ headerShown: false }} />
            <Stack.Screen name="detail" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </>
        ) : (
          <>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding1" />
            <Stack.Screen name="onboarding2" />
            <Stack.Screen name="onboarding3" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="login" />
            <Stack.Screen name="+not-found" />
          </>
        )}
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
