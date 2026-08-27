import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#c9b97a',
        tabBarInactiveTintColor: '#5a5446',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: '#0f0e0c',
            borderTopColor: '#2a2720',
            borderTopWidth: 1,
          },
          default: {
            backgroundColor: '#0f0e0c',
            borderTopColor: '#2a2720',
            borderTopWidth: 1,
          },
        }),
      }}>

      <Tabs.Screen
        name="index"
        options={{
          title: 'Counsel',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="text.bubble.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="detail"
        options={{
          title: 'Results',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="scroll.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="books.vertical.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="chart.bar.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="gearshape.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
