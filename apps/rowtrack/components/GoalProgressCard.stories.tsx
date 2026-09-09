import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { GoalProgressCard } from './GoalProgressCard';
import type { PeriodGoalProgress } from '@/lib/hooks/usePeriodGoal';

/**
 * `progress` is één samengesteld object (periode + metriek + target + stand), geen variant-as:
 * de kaart heeft geen enkele prop die een string-literal-union of boolean is. Deze component
 * levert dus géén assen aan de Figma-sync-guard — de verschillen tussen de stories hieronder
 * zijn data, geen varianten.
 *
 * `percentage` staat los van `current`/`target` in het type, dus de stories zetten hem
 * consistent: de kaart floort hem voor de teller maar leidt "nog te gaan" uit target − current af.
 */
const distanceWeek: PeriodGoalProgress = {
  goal: { period: 'week', metric: 'distance', target: 20000 },
  current: 12500,
  percentage: 62.5,
};

const meta = {
  title: 'Componenten/GoalProgressCard',
  component: GoalProgressCard,
  argTypes: {
    progress: { control: 'object' },
    onEdit: { control: false },
  },
  args: {
    progress: distanceWeek,
    onEdit: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2036-21013' },
  },
} satisfies Meta<typeof GoalProgressCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle args in meta. */
export const Playground: Story = {};

/** Duur-doel: 5 u per maand, 3 u 20 min gevaren — toont de "1 u 40 min te gaan"-tekst. */
export const DuurMaand: Story = {
  args: {
    progress: {
      goal: { period: 'month', metric: 'duration', target: 18000 },
      current: 12000,
      percentage: 66.7,
    },
  },
};

/** Workouts-doel: telt sessies i.p.v. meters, met een eigen "nog N trainingen"-tekst. */
export const AantalTrainingen: Story = {
  args: {
    progress: {
      goal: { period: 'week', metric: 'workouts', target: 4 },
      current: 3,
      percentage: 75,
    },
  },
};

/** Edge case: verse periode, nog niets gevaren — 0 %, lege balk, volledige rest te gaan. */
export const Nulwaarde: Story = {
  args: {
    progress: {
      goal: { period: 'week', metric: 'distance', target: 20000 },
      current: 0,
      percentage: 0,
    },
  },
};

/** Edge case: doel voorbij — de fill clampt op 100 % en "nog te gaan" valt op nul terug. */
export const Behaald: Story = {
  args: {
    progress: {
      goal: { period: 'week', metric: 'distance', target: 20000 },
      current: 23400,
      percentage: 117,
    },
  },
};

/**
 * Edge case: onder 1 km toont de kaart meters i.p.v. kilometers, en de floor houdt
 * 99,6 % op 99 % — een drempel mag pas kloppen als hij écht bereikt is.
 */
export const BijnaBehaald: Story = {
  args: {
    progress: {
      goal: { period: 'week', metric: 'distance', target: 20000 },
      current: 19920,
      percentage: 99.6,
    },
  },
};

/** Ontbrekende optionele prop: zonder `onEdit` verdwijnt de actie rechts in de subtitel. */
export const ZonderBewerken: Story = {
  args: { onEdit: undefined },
};
