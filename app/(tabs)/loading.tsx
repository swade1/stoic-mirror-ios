import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAtom } from 'jotai';
import { sessionsAtom, Session } from '@/lib/atoms';
import { supabase } from '@/lib/supabase';

export default function LoadingScreen() {
  const router = useRouter();
  const { prompt } = useLocalSearchParams<{ prompt: string }>();
  const [, setSessions] = useAtom(sessionsAtom);

  useEffect(() => {
    (async () => {
      try {
        if (!prompt) throw new Error('No prompt provided');
        const response = await supabase.functions.invoke('generate', { body: JSON.stringify({ prompt }) });
        if (response.error) throw response.error;
        const data = response.data as Session;
        setSessions((prev: Session[]) => [data, ...prev]);
        router.replace(`/detail?id=${data.id}`);
      } catch (error) {
        Alert.alert('Error', (error as Error).message);
        router.replace('(tabs)');
      }
    })();
  }, [prompt, router, setSessions]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Generating your first experience</Text>
      <ActivityIndicator size="large" color="#000" style={styles.spinner} />
      <Text style={styles.subtitle}>Please wait while we create your journey</Text>
      <View style={styles.button}>
        <Text style={styles.buttonText}>Please Wait</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', alignItems:'center', padding:24 },
  title: { fontSize:24, fontWeight:'bold', marginBottom:16 },
  spinner: { marginVertical:24 },
  progressText: { fontSize:16, marginBottom:8 },
  subtitle: { fontSize:14, color:'#666', marginBottom:24 },
  button: { backgroundColor:'#000', paddingVertical:12, paddingHorizontal:32, borderRadius:8 },
  buttonText: { color:'#fff', fontSize:16, fontWeight:'bold' }
});
