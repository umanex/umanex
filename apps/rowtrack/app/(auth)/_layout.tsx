import { Stack } from 'expo-router';
import { background } from '@/constants';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: background.base },
      }}
    />
  );
}
