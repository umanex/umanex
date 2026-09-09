import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { space } from '@/constants';
import { EmptyState } from './EmptyState';

/**
 * `size` is de enige variant-as: hij schakelt tegelijk container, icoonmaat en titel-typografie.
 *
 * `icon` is géén as maar een slot — een Ionicons-naam, in Figma een instance-swap-property.
 * `iconSize` evenmin: dat is een numerieke override op de maat die `size` al kiest (48 / 64),
 * geen tweede reeks varianten.
 */
const meta = {
  title: 'Componenten/EmptyState',
  component: EmptyState,
  argTypes: {
    size: { control: 'select', options: ['sm', 'lg'] },
    icon: { control: false },
    iconSize: { control: 'number' },
  },
  args: {
    icon: 'water-outline',
    title: 'Nog geen workouts — tijd om te beginnen!',
    subtitle: 'Koppel je ergometer en roei je eerste 2.000 m.',
    size: 'sm',
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2036-20900' },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

export const Groot: Story = {
  args: {
    size: 'lg',
    icon: 'alert-circle-outline',
    title: 'Workout niet gevonden',
    subtitle: 'Deze rit staat niet meer in je archief.',
  },
};

/** Zoals de app hem het vaakst gebruikt: alleen een titel, geen subtitel. */
export const ZonderSubtitel: Story = {
  args: { icon: 'time-outline', title: 'Geen workouts in deze periode.', subtitle: undefined },
};

/** Edge case: een titel die over twee regels loopt moet gecentreerd blijven, niet afknippen. */
export const LangeTitel: Story = {
  args: {
    icon: 'pulse-outline',
    title: 'Geen hartslag-detail per segment. Beschikbaar vanaf je volgende training.',
    subtitle: undefined,
  },
};

/**
 * `iconSize` overschrijft de maat die `size` zou kiezen. De tokens hebben geen icoon-schaal,
 * dus de waarde komt uit de spacing-schaal in plaats van uit een literal.
 */
export const KleinIcoon: Story = {
  args: { iconSize: space['32'], title: 'Geen splits beschikbaar.', subtitle: undefined },
};
