import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { GoalPill } from './GoalPill';

/**
 * `goal` is een samengesteld object, geen variant-as: het doeltype bepaalt zowel de waarde
 * als de eenheid, en dat verschil is data. De vijf gevallen staan daarom als aparte stories.
 */
const meta = {
  title: 'Componenten/GoalPill',
  component: GoalPill,
  argTypes: {
    goal: { control: 'object' },
  },
  args: {
    goal: { type: 'duration', target: 1800 },
  },
} satisfies Meta<typeof GoalPill>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Duurdoel 30 min — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Geen doel: alleen "Geen", zonder eenheid. */
export const ZonderDoel: Story = { args: { goal: null } };

/** Afstandsdoel 10 km — boven 1000 m schakelt de eenheid naar km. */
export const DoelAfstand: Story = { args: { goal: { type: 'distance', target: 10000 } } };

/** Splitdoel 2:20 — de eenheid is de frame-copy, niet "s". */
export const DoelSplit: Story = { args: { goal: { type: 'split', target: 140 } } };

/** Vermogensdoel 180 W. */
export const DoelVermogen: Story = { args: { goal: { type: 'watts', target: 180 } } };
