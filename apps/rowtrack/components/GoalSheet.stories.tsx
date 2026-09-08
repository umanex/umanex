import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GoalSheet } from './GoalSheet';

/**
 * `visible` is de enige as: de overige props zijn data (`currentGoal`, `userId`) of callbacks.
 * De sheet zit in een `Modal`, dus hij staat in elke story open — op `visible: false` rendert
 * de story leeg.
 *
 * `userId` staat bewust op `undefined`. De sheet is zelf-persisterend en schrijft
 * `period_goal_*` rechtstreeks naar `profiles`; zonder id keert `persist()` meteen terug, zodat
 * Opslaan en Wissen in Storybook geen echte rij aanraken.
 *
 * PERIODE en TYPE zijn interne state die uit `currentGoal` geïnitialiseerd wordt — de stories
 * hieronder sturen ze dus via `currentGoal`, niet via een eigen prop.
 *
 * De `SafeAreaProvider`-decorator is geen mock maar dezelfde provider die de app in
 * `app/_layout.tsx` op de root zet: de onderliggende `BottomSheet` roept `useSafeAreaInsets()`
 * aan, en die gooit zonder provider. Hoort op termijn in `.storybook/preview.tsx`, zodat elk
 * insets-lezend component hem krijgt in plaats van per story.
 */
const meta = {
  title: 'Componenten/GoalSheet',
  component: GoalSheet,
  decorators: [
    (Story) => (
      <SafeAreaProvider>
        <Story />
      </SafeAreaProvider>
    ),
  ],
  argTypes: {
    visible: { control: 'boolean' },
    currentGoal: { control: 'object' },
    userId: { control: 'text' },
    onClose: { control: false },
    onSaved: { control: false },
  },
  args: {
    visible: true,
    currentGoal: { period: 'week', metric: 'distance', target: 20000 },
    userId: undefined,
    onClose: () => {},
    onSaved: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2016-10942' },
  },
} satisfies Meta<typeof GoalSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle args in meta. */
export const Playground: Story = {};

/**
 * Lege toestand: nog geen doel ingesteld. Periode en type staan op niets, Opslaan is
 * uitgeschakeld tot beide gekozen zijn, de wheel verschijnt pas ná een type, en de
 * Wissen-knop ontbreekt — er valt niets te wissen.
 */
export const NogGeenDoel: Story = {
  args: { currentGoal: null },
};

/** Maanddoel op duur: 300 min, wat de wheel als "5 u" toont. */
export const MaanddoelDuur: Story = {
  args: { currentGoal: { period: 'month', metric: 'duration', target: 18000 } },
};

/** Doel op aantal trainingen: 4 sessies per week — de wheel telt sessies, geen meters. */
export const AantalTrainingen: Story = {
  args: { currentGoal: { period: 'week', metric: 'workouts', target: 4 } },
};

/** Edge case: bovengrens van de afstand-wheel (500 km per maand), de laatste rij. */
export const MaximaleAfstand: Story = {
  args: { currentGoal: { period: 'month', metric: 'distance', target: 500000 } },
};

/** Edge case: ondergrens van de duur-wheel (5 min), de eerste rij. */
export const MinimaleDuur: Story = {
  args: { currentGoal: { period: 'week', metric: 'duration', target: 300 } },
};

/**
 * Edge case: een opgeslagen doel onder het wheel-bereik — 400 m, terwijl de afstand-wheel
 * pas bij 1 km begint. De sheet klemt naar de eerste rij in plaats van leeg te vallen.
 */
export const DoelBuitenBereik: Story = {
  args: { currentGoal: { period: 'week', metric: 'distance', target: 400 } },
};
