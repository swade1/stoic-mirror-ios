import { Theme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import * as SplashScreen from 'expo-splash-screen';
import Purchases from 'react-native-purchases';

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
  // Tracks the previous signed-in state so we can tell a genuine sign-in
  // (was signed out, now signed in) apart from a SIGNED_IN event fired by
  // re-authenticating while already signed in (e.g. change-password's
  // current-password verification step).
  const wasSignedInRef = React.useRef<boolean | null>(null);

  useEffect(() => {
    Purchases.configure({
      apiKey: 'test_YogsUwNBuOrctiWVgJBBcqyhRSL',
    });
  },[]);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const signedIn = !!data.session && !!data.session.user;
      wasSignedInRef.current = signedIn;
      setIsSignedIn(signedIn);
    };
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const isAuthenticated = !!session && !!session.user;
      const wasSignedIn = wasSignedInRef.current;
      wasSignedInRef.current = isAuthenticated;
      setIsSignedIn(isAuthenticated);
      if (event === 'SIGNED_IN' && isAuthenticated && wasSignedIn === false) {
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
       <Stack
         screenOptions={{
           headerShown: false,
           animation: 'fade',
         }}
       >
        {/* Requires a signed-in session — Stack.Protected actually blocks
            navigation when the guard is false, unlike conditionally
            rendering different Stack.Screen sets. */}
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="loading" />
          <Stack.Screen name="detail" />
          <Stack.Screen name="concerns" />
          <Stack.Screen name="change-password" />
        </Stack.Protected>

        {/* Only reachable before an account exists */}
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding1" />
          <Stack.Screen name="onboarding2" />
          <Stack.Screen name="onboarding3" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="login" />
        </Stack.Protected>

        {/* Reachable either way — paywall is part of the pre-account
            onboarding funnel, and legal pages should stay public */}
        <Stack.Screen name="paywall" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
