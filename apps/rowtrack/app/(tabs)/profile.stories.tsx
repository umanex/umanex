import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { HealthConsentProvider } from '@/lib/health-consent-context';
import { TOESTEL } from '../../.storybook/toestel';
import ProfileScreen from './profile';

/**
 * Het profielscherm hangt aan twee contexten — `AuthProvider` voor de gebruiker en
 * `HealthConsentProvider` voor de toestemming — en beide halen hun staat uit supabase. Eén
 * `parameters.supabase` bedient ze daarom allebei; een aparte context-mock zou dezelfde
 * waarheid een tweede keer opschrijven.
 */
const profiel = {
  id: '00000000-0000-4000-8000-000000000001',
  display_name: 'Jeroen',
  gender: 'male',
  height_cm: 183,
  weight_kg: 78.5,
  birth_date: '1985-04-12',
  spm_halved: false,
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
  title: 'Componenten/ProfileScreen',
  component: ProfileScreen,
  decorators: [(Story) => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <AuthProvider><HealthConsentProvider><Story /></HealthConsentProvider></AuthProvider>
    </SafeAreaProvider>
  )],
  parameters: {
    toestel: TOESTEL.portret,
    supabase: { session: true, tabellen: { profiles: [profiel] } },
  },
} satisfies Meta<typeof ProfileScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ingevuld profiel — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Verse gebruiker: het profiel bestaat wel, maar de lichaamsvelden zijn nog leeg. */
export const Onvolledig: Story = {
  parameters: {
    toestel: TOESTEL.portret,
    supabase: {
      session: true,
      tabellen: { profiles: [{ ...profiel, display_name: null, gender: null, height_cm: null, weight_kg: null, birth_date: null }] },
    },
  },
};

/** Zonder profielgewicht is de kcal-berekening een schatting — dat raakt de hele app. */
export const ZonderGewicht: Story = {
  parameters: {
    toestel: TOESTEL.portret,
    supabase: { session: true, tabellen: { profiles: [{ ...profiel, weight_kg: null }] } },
  },
};
