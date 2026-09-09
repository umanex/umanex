import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { TOESTEL } from '../../../.storybook/toestel';
import HistoryScreen from './index';

/**
 * Het archief leest zijn ritten uit supabase en zijn gebruiker uit `AuthProvider` — en die
 * haalt zijn sessie óók uit supabase, dus één `parameters.supabase` bedient beide.
 *
 * Zonder rijen valt het scherm in zijn empty state. Dat is een echte toestand en staat als
 * eigen story, maar de Playground toont een gevuld archief: dát is wat de gebruiker meestal
 * ziet, en een bouwspec van de lege variant zou een scherm meten dat zelden bestaat.
 */
const rit = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `w${i}`,
  started_at: `2026-09-0${i} 07:${10 + i}:00+00`,
  duration_seconds: 1500 + i * 120,
  distance_meters: 5000 + i * 350,
  avg_watts: 195 + i * 6,
  avg_spm: 24 + (i % 3),
  avg_split_seconds: 118 - i,
  calories: 220 + i * 15,
  is_pr: i === 1,
  ...extra,
});

/**
 * Vaste safe-area-metrics: Storybook heeft geen notch, en een safe-area-waarde is een
 * toestelmaat en geen designtoken — dezelfde regel als `insets: geenInsets` in de
 * workout-stories. `initialMetrics` meegeven maakt de provider synchroon; zonder die prop
 * meet hij zijn eigen frame en rendert het scherm één tik lang leeg.
 */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 430, height: 932 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const meta = {
  title: 'Componenten/HistoryScreen',
  component: HistoryScreen,
  decorators: [(Story) => (
    <SafeAreaProvider initialMetrics={METRICS}><AuthProvider><Story /></AuthProvider></SafeAreaProvider>
  )],
  parameters: {
    toestel: TOESTEL.portret,
    supabase: { session: true, tabellen: { workouts: [rit(1), rit(2), rit(3), rit(4), rit(5)] } },
  },
} satisfies Meta<typeof HistoryScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Gevuld archief — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Nog geen ritten: de empty state met zijn uitnodiging om te beginnen. */
export const Leeg: Story = {
  parameters: { toestel: TOESTEL.portret, supabase: { session: true, tabellen: { workouts: [] } } },
};

/** Eén rit, en die is een persoonlijk record — de PR-markering staat op de rij. */
export const EenRecord: Story = {
  parameters: { toestel: TOESTEL.portret, supabase: { session: true, tabellen: { workouts: [rit(1)] } } },
};
