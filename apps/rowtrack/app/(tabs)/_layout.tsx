import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BleProvider } from '@/lib/ble/ble-context';
import { WorkoutPhaseProvider, useWorkoutPhase } from '@/lib/workout-phase-context';
import { background, brand, text as textColors, border, layout, space, fontSize, fontFamily } from '@/constants';

function TabsInner() {
  const insets = useSafeAreaInsets();
  const { phase } = useWorkoutPhase();
  const hideTabBar = phase === 'active' || phase === 'summary';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: textColors.muted,
        tabBarStyle: hideTabBar
          ? { display: 'none' }
          : {
              backgroundColor: background.surface,
              borderTopColor: border.subtle,
              height: layout.navHeight + insets.bottom,
              paddingBottom: insets.bottom,
              paddingTop: space[2],
            },
        tabBarLabelStyle: {
          fontSize: fontSize['11'],
          fontFamily: fontFamily.bodyMedium,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Training',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historiek',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profiel',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <BleProvider>
      <WorkoutPhaseProvider>
        <TabsInner />
      </WorkoutPhaseProvider>
    </BleProvider>
  );
}
