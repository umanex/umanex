import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { TOESTEL } from '../../../.storybook/toestel';
import WorkoutDetailScreen from './[id]';

/**
 * Het detailscherm leest zijn id uit de route-parameters en de rit uit supabase. De mock geeft
 * op `.single()` de eerste rij; is die er niet, dan levert hij PGRST116 — precies de code die
 * dit scherm als "niet gevonden" leest in plaats van als fout. Beide toestanden staan hier.
 */
const rit = {
  id: 'w1',
  started_at: '2026-09-01 07:11:00+00',
  duration_seconds: 1804,
  distance_meters: 5230,
  avg_watts: 208,
  avg_spm: 25,
  avg_split_seconds: 112,
  calories: 238,
  max_watts: 268,
  max_spm: 32,
  best_split: 107,
  avg_heart_rate: 148,
  max_heart_rate: 175,
  resistance_level: 5,
  notes: null,
  goal_type: 'duration',
  goal_target: 1800,
  goal_reached: true,
  splits: [
    { distance: 500, split: 113.2, watts: 206 },
    { distance: 1000, split: 111.8, watts: 214 },
    { distance: 1500, split: 112.6, watts: 209 },
  ],
  is_pr: true,
  best_2k_seconds: 468,
  samples: null,
  total_strokes: 486,
};

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
  title: 'Componenten/WorkoutDetailScreen',
  component: WorkoutDetailScreen,
  decorators: [(Story) => (
    <SafeAreaProvider initialMetrics={METRICS}><AuthProvider><Story /></AuthProvider></SafeAreaProvider>
  )],
  parameters: {
    toestel: TOESTEL.portret,
    routeParams: { id: 'w1' },
    supabase: { session: true, tabellen: { workouts: [rit] } },
  },
} satisfies Meta<typeof WorkoutDetailScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Volledige rit met splits en een record — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Zonder hartslagband: de BPM-waarden vallen terug op "—". */
export const ZonderHartslag: Story = {
  parameters: {
    toestel: TOESTEL.portret,
    routeParams: { id: 'w1' },
    supabase: { session: true, tabellen: { workouts: [{ ...rit, avg_heart_rate: null, max_heart_rate: null, is_pr: false }] } },
  },
};

/** De rit bestaat niet (of is verwijderd): PGRST116, dus "niet gevonden" en geen foutmelding. */
export const NietGevonden: Story = {
  parameters: {
    toestel: TOESTEL.portret,
    routeParams: { id: 'weg' },
    supabase: { session: true, tabellen: { workouts: [] } },
  },
};
