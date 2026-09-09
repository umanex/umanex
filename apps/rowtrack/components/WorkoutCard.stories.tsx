import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { PrEntry } from '@/lib/personalRecords';
import { WorkoutCard, type WorkoutRowData } from './WorkoutCard';

/**
 * ÉÉN variant-as: `index`, met opzet teruggebracht tot [0, 1]. De zebra-striping komt uit
 * `index % 2` (`WorkoutCard.tsx:109`), dus alleen de pariteit is zichtbaar — rij 7 ziet er
 * uit als rij 1. De as stond hier tot 2026-09-09 NIET, met als reden "een getal is geen
 * union"; gemeten gevolg: de library kende maar één WorkoutCard, en de twee kaarten met een
 * raised tile in HistoryScreen/Playground waren de laatste twee parity-verschillen
 * (`vulling: browser wel tegen Figma niet`). Een zichtbare vorm die de library niet kan
 * uitdrukken, is een vorm die de koppeling moet raden.
 *
 * De PR-badge blijft wél een named story en geen as: die hangt aan de aanwezigheid van
 * `prEntries` en verandert het aantal kinderen van `dateRow`, en een instance kan geen kind
 * bijkrijgen. Dat verschil is gemeten (`kinderen 1 tegen 2`) en valt terug op een nagebouwde
 * subboom, met melding.
 *
 * De datum is bewust een vaste dag in het verleden: `fmtDate` schrijft vandaag en gisteren
 * uit als woord, en dan zou de render per dag veranderen.
 */
const basisRit: WorkoutRowData = {
  id: 'wk-2026-08-20-0712',
  started_at: '2026-08-20T07:12:00.000Z',
  duration_seconds: 1471,
  distance_meters: 5000,
  calories: 312,
};

const afstandRecord: PrEntry = {
  metric: 'distance',
  value: 5000,
  previous: 4820,
  previous_at: '2026-08-02T06:55:00.000Z',
};

const meta = {
  title: 'Componenten/WorkoutCard',
  component: WorkoutCard,
  argTypes: {
    onPress: { control: false },
    index: { control: 'select', options: [0, 1] },
  },
  args: {
    workout: basisRit,
    index: 0,
    prEntries: null,
    onPress: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2036-20961' },
  },
} satisfies Meta<typeof WorkoutCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Oneven rij-index: zebra-striping legt er de raised tile onder. */
export const ZebraOneven: Story = {
  args: { index: 1 },
};

/** Eén gebroken record — de badge draagt de metric zelf. */
export const MetRecord: Story = {
  args: { prEntries: [afstandRecord] },
};

/** Meer dan één record: de badge draagt het aantal, want de metrics passen niet naast elkaar. */
export const MeerdereRecords: Story = {
  args: {
    prEntries: [
      afstandRecord,
      { metric: 'best2k', value: 462, previous: 471, previous_at: '2026-07-28T06:40:00.000Z' },
      { metric: 'watts', value: 243, previous: 231, previous_at: '2026-08-02T06:55:00.000Z' },
    ],
  },
};

/**
 * Lege array = wél een record, alleen zonder bekende metric (ritten van vóór
 * `workouts.pr_metrics`). Onderscheid met `null`: dat betekent géén record.
 */
export const RecordZonderMetric: Story = {
  args: { prEntries: [] },
};

/** Onder de minuut krijgen seconden hun eigen eenheid — '0:45 min' zou twee keer fout zijn. */
export const KorteRit: Story = {
  args: {
    workout: { ...basisRit, id: 'wk-kort', duration_seconds: 45, distance_meters: 180, calories: 9 },
  },
};

/** Boven het uur schuift de duur naar u:mm:ss en verbreedt de linkerkolom. */
export const LangeRit: Story = {
  args: {
    workout: {
      ...basisRit,
      id: 'wk-lang',
      duration_seconds: 4231,
      distance_meters: 14200,
      calories: 892,
    },
  },
};

/** Edge case: een rit zonder gemeten duur, afstand of calorieën — alleen de datum blijft. */
export const OnvolledigeRit: Story = {
  args: {
    workout: {
      id: 'wk-leeg',
      started_at: '2026-08-14T18:30:00.000Z',
      duration_seconds: null,
      distance_meters: null,
      calories: null,
    },
  },
};
