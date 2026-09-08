import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Chip } from './Chip';

/**
 * `active` is de enige as: `value` en `unit` zijn vrije strings die het label vullen. In
 * IdlePhase staat de chip in een rij van drie doelsuggesties (`flex: 1`), dus hij hugt hier
 * niet — de breedte komt van zijn container, de hoogte van `minHeight: 44`.
 */
const meta = {
  title: 'Componenten/Chip',
  component: Chip,
  argTypes: {
    active: { control: 'boolean' },
    onPress: { control: false },
  },
  args: {
    value: '2000',
    unit: 'm',
    active: false,
    onPress: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2020-12347' },
  },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Geselecteerde suggestie: accent-fill, accent-rand, accent-tekst. */
export const Actief: Story = {
  args: { active: true },
};

/** Tijddoel in plaats van afstandsdoel — dezelfde chip, andere eenheid. */
export const Tijddoel: Story = {
  args: { value: '30', unit: 'min', active: true },
};

/** Splitdoel: de langste realistische waarde in de rij van drie. */
export const Splitdoel: Story = {
  args: { value: '1:52.4', unit: '/500m' },
};

/** Edge case: `unit` is optioneel — zonder eenheid vervalt de tweede Text. */
export const ZonderEenheid: Story = {
  args: { value: '5000', unit: undefined },
};

/** Edge case: nulwaarde blijft een geldige waarde, geen lege chip. */
export const Nulwaarde: Story = {
  args: { value: '0', unit: 'm' },
};

/** Edge case: de chip knipt niet af maar groeit — `minHeight`, geen vaste `height`. */
export const LangeWaarde: Story = {
  args: { value: '21097', unit: 'm' },
};
