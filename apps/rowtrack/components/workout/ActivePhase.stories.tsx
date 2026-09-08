import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Animated } from 'react-native';
import { TOESTEL } from '../../.storybook/toestel';
import { ActivePhase } from './ActivePhase';
import type { WorkoutMetricsState } from '@/lib/hooks/useWorkoutMetrics';

/**
 * De argTypes met `options` of een boolean-control zijn de variant-assen. Vier stuks hier:
 * `phase` (het scherm vs. de samenvatting-modal), `bleStatus` (de verbindings-overlay),
 * `hrStatus` (de BPM-rij) en `hasProfileWeight` (het sterretje achter kcal).
 *
 * `isCountdown` en `paceZone` staan wél in het props-type maar worden nergens
 * gedestructureerd of gelezen — een as ervan maken zou in Figma varianten opleveren die
 * onderling identiek renderen. Ze staan daarom op `control: false`; verdwijnen ze uit het
 * type, dan verandert er niets aan de assen.
 *
 * `goal` en `metricsState` zijn samengestelde objecten, geen assen: het doeltype bepaalt de
 * hero, de subtitle, de KPI-volgorde én de progress-fill, en dat verschil is data. De vier
 * doeltypes staan hieronder als aparte stories.
 *
 * `insets` staat op nul: Storybook heeft geen notch, en een safe-area-waarde is een
 * toestelmaat, geen designtoken.
 */
const metrics: WorkoutMetricsState = {
  seconds: 1124, // 18:44
  watts: 214,
  spm: 26,
  splitSeconds: 112, // 1:52 /500m
  distanceMeters: 5000,
  calories: 238,
  resistanceLevel: 5,
  wattsSmoothed: 208,
  spmSmoothed: 25.6,
  splitSmoothed: 112.4,
};

const geenInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const meta = {
  title: 'Componenten/ActivePhase',
  component: ActivePhase,
  argTypes: {
    phase: { control: 'select', options: ['active', 'summary'] },
    bleStatus: {
      control: 'select',
      options: [
        'idle',
        'scanning',
        'connecting',
        'discovering',
        'connected',
        'disconnecting',
        'reconnecting',
        'error',
      ],
    },
    hrStatus: { control: 'select', options: ['idle', 'scanning', 'waiting', 'connected', 'error'] },
    hasProfileWeight: { control: 'boolean' },
    isCountdown: { control: false },
    paceZone: { control: false },
    metricsState: { control: 'object' },
    goal: { control: 'object' },
    splits: { control: 'object' },
    prEntries: { control: 'object' },
    insets: { control: 'object' },
    pulseAnim: { control: false },
    startScan: { control: false },
    startHRScan: { control: false },
    onStop: { control: false },
    onContinue: { control: false },
    onGoalContinue: { control: false },
  },
  args: {
    phase: 'active',
    metricsState: metrics,
    bleStatus: 'connected',
    deviceName: 'Concept2 PM5 4821',
    bleError: null,
    startScan: () => {},
    goal: { type: 'duration', target: 1800 }, // 30 min
    isCountdown: false,
    paceZone: 'on_pace',
    toastMsg: null,
    splits: [
      { distance: 500, split: 113.2, watts: 206 },
      { distance: 1000, split: 111.8, watts: 214 },
      { distance: 1500, split: 112.6, watts: 209 },
    ],
    prEntries: [],
    pulseAnim: new Animated.Value(1),
    avgWatts: 208,
    avgSpm: 25,
    avgSplit: 113,
    summaryMaxWatts: 268,
    summaryBestSplit: 107,
    summaryAvgHr: 148,
    summaryMaxSpm: 32,
    summaryMaxHr: 175,
    summaryTotalStrokes: 486,
    onStop: () => {},
    onContinue: () => {},
    onGoalContinue: () => {},
    hasProfileWeight: true,
    hrStatus: 'connected',
    hrBpm: 148,
    startHRScan: () => {},
    insets: geenInsets,
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2020-13601' },
    // Een scherm rendert full-bleed op toestelmaat in plaats van hug-met-lucht: zonder dit
    // mat ActivePhase 303,52 x 719. Zie .storybook/toestel.ts.
    toestel: TOESTEL.portret,
  },
} satisfies Meta<typeof ActivePhase>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle args in meta. */
export const Playground: Story = {};

/** Geen doel: de hero telt óp (verstreken tijd), de afstand zakt naar de subtitle. */
export const ZonderDoel: Story = {
  args: { goal: null },
};

/** Afstandsdoel 2 km: de hero telt áf in meters, de KPI-lijst ruilt Afstand voor Tijd. */
export const DoelAfstand: Story = {
  args: {
    goal: { type: 'distance', target: 2000 },
    metricsState: { ...metrics, seconds: 326, distanceMeters: 1450, calories: 69 },
  },
};

/** Splitdoel 1:55: geen aftel-hero maar de huidige split, met coaching eronder. */
export const DoelSplit: Story = {
  args: { goal: { type: 'split', target: 115 } },
};

/** Vermogensdoel 200 W: de fill kleurt groen zodra je erboven zit (208 W hier). */
export const DoelVermogen: Story = {
  args: { goal: { type: 'watts', target: 200 } },
};

/** Loading: de verbindings-overlay dekt het scherm zolang de trainer niet verbonden is. */
export const Verbinden: Story = {
  args: { bleStatus: 'connecting' },
};

/** Fout: de overlay toont de BLE-melding met Opnieuw + Stop, zodat je niet vastzit. */
export const Fout: Story = {
  args: {
    bleStatus: 'error',
    bleError: 'Verbinding met de roeitrainer verbroken',
  },
};

/** De BPM-rij toont een spinner in plaats van een waarde zolang de band gezocht wordt. */
export const HartslagZoeken: Story = {
  args: { hrStatus: 'scanning', hrBpm: null },
};

/** Geen band: de BPM-rij toont "—" en is tikbaar om alsnog te scannen. */
export const ZonderHartslagband: Story = {
  args: { hrStatus: 'idle', hrBpm: null },
};

/**
 * Edge case: verse rit, nog geen haal gedaan. `splitSmoothed` staat op oneindig — dat is
 * de initiële waarde uit `useWorkoutMetrics` en rendert als "—", niet als "0:00".
 */
export const Nulwaarde: Story = {
  args: {
    metricsState: {
      seconds: 0,
      watts: 0,
      spm: 0,
      splitSeconds: 0,
      distanceMeters: 0,
      calories: 0,
      resistanceLevel: null,
      wattsSmoothed: 0,
      spmSmoothed: 0,
      splitSmoothed: Number.POSITIVE_INFINITY,
    },
    hrBpm: null,
  },
};

/** Zonder profielgewicht is kcal een schatting — de waarde krijgt een sterretje. */
export const ZonderProfielgewicht: Story = {
  args: { hasProfileWeight: false },
};

/** Doel gehaald: de motivatie-toast schuift over het scherm met "Ga verder". */
export const DoelBereikt: Story = {
  args: { toastMsg: 'Doel behaald — 30 minuten gevaren!' },
};

/** De samenvatting-modal na het stoppen: KPI-band, gem/piek-tabel en Ga verder. */
export const Samenvatting: Story = {
  args: { phase: 'summary' },
};

/** Records gebroken: de banner noemt per record de nieuwe waarde en wat hij verving. */
export const SamenvattingMetRecords: Story = {
  args: {
    phase: 'summary',
    prEntries: [
      { metric: 'distance', value: 5000, previous: 4620, previous_at: '2026-08-14T18:12:00+00:00' },
      { metric: 'watts', value: 208, previous: 197, previous_at: '2026-07-29T07:41:00+00:00' },
    ],
  },
};

/**
 * Edge case: zonder hartslagband en zonder piekwaarden vallen de betreffende cellen op "—".
 * Ze zijn `number | null` in het type, dus dit is de nul-kant van elke summary-waarde.
 */
export const SamenvattingZonderHartslag: Story = {
  args: {
    phase: 'summary',
    summaryAvgHr: null,
    summaryMaxHr: null,
    summaryMaxSpm: null,
    summaryBestSplit: null,
    summaryMaxWatts: null,
    summaryTotalStrokes: null,
    hrStatus: 'idle',
    hrBpm: null,
  },
};

/**
 * Landscape: twee gelijke kolommen met een verticale progress-bar ertussen. De layout
 * schakelt op `useWindowDimensions()`, dus dit is de enige story die het viewport kantelt —
 * en daarmee de enige meting die de landscape-tak van ActivePhase überhaupt raakt.
 */
export const Landscape: Story = {
  parameters: { toestel: TOESTEL.landschap },
};
