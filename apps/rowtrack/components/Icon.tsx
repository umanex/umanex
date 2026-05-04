import { type ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IoniconsName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 24, color = '#FFFFFF' }: IconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}

export type { IoniconsName };
