import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { accent, fg, status } from '@/constants';
import { Dot } from './Dot';

/**
 * Dot heeft géén variant-as: `color` is een vrije kleurwaarde, geen union en geen boolean.
 * In Figma is dit dus één node met een gebonden fill, geen component set.
 *
 * `color` blijft bewust uit `meta.args`, zodat Playground de component-default (`fg.tertiary`)
 * meet in plaats van een kleur die deze story kiest. De named stories tonen de drie rollen
 * waarin de dot in de app terugkomt.
 */
const meta = {
  title: 'Componenten/Dot',
  component: Dot,
  argTypes: {
    color: { control: 'color' },
  },
  args: {},
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2025-14444' },
  },
} satisfies Meta<typeof Dot>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Scheidingsteken tussen twee waarden in WorkoutCard / GoalProgressCard. */
export const Standaard: Story = {
  args: { color: fg.tertiary },
};

/** Statusdot van een verbonden roeitrainer (verkeerslicht-groen). */
export const Verbonden: Story = {
  args: { color: status.success },
};

/** Statusdot tijdens verbinden — merk-accent, niet groen. */
export const Verbindt: Story = {
  args: { color: accent.default },
};

/** Statusdot na een gefaalde BLE-verbinding. */
export const Fout: Story = {
  args: { color: status.error },
};
