import { supabase } from '@/lib/supabase';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';

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
      console.log('Auth state change:', event, 'isAuthenticated:', isAuthenticated);
      
      // Update state first
      setIsSignedIn(isAuthenticated);
      
      // Only handle automatic navigation for sign-in
      // Sign-out navigation is handled manually in components
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
    <ThemeProvider value={DefaultTheme}>
      <Stack
        screenOptions={{ headerShown: false }}
      >
        {isSignedIn ? (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </>
        ) : (
          <>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding1" />
            <Stack.Screen name="onboarding2" />
            <Stack.Screen name="onboarding3" />
            <Stack.Screen name="onboardingPathos" />
            <Stack.Screen name="onboardingEthos" />
            <Stack.Screen name="onboardingLogos" />
            <Stack.Screen name="personalization" />
            <Stack.Screen name="personalizingscreen" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="login" />
            <Stack.Screen name="+not-found" />
          </>
        )}
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
