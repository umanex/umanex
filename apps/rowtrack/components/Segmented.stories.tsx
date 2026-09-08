import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Segmented, type SegmentedOption } from './Segmented';

/**
 * De enige variant-as is `variant` (`filled` | `band`) — dat is precies het verschil dat
 * de component zelf documenteert: zelf-bevattende track vs. volle-breedte band.
 *
 * `value` is géén as. Het type is `T | null` (T = string), dus geen literal-union, en het
 * bepaalt welk kind actief is: in Figma draagt het segment-kind de actief/inactief-staat,
 * niet de container. `options` is data (een array), `onChange` een functie en `style`
 * layout van de parent — alle drie `control: false`.
 */
const detailTabs: readonly SegmentedOption<string>[] = [
  { value: 'overzicht', label: 'Overzicht' },
  { value: 'splits', label: 'Splits' },
  { value: 'hartslag', label: 'Hartslag' },
];

const periodeOpties: readonly SegmentedOption<string>[] = [
  { value: 'week', label: 'Week' },
  { value: 'maand', label: 'Maand' },
  { value: 'jaar', label: 'Jaar' },
];

const afstandOpties: readonly SegmentedOption<string>[] = [
  { value: 'alles', label: 'Alles' },
  { value: '2000', label: '2000 m' },
  { value: '5000', label: '5000 m' },
];

const meta = {
  title: 'Componenten/Segmented',
  component: Segmented,
  argTypes: {
    variant: { control: 'select', options: ['filled', 'band'] },
    options: { control: false },
    onChange: { control: false },
    style: { control: false },
  },
  args: {
    options: periodeOpties,
    value: 'week',
    variant: 'filled',
    onChange: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2020-12470' },
  },
} satisfies Meta<typeof Segmented>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/**
 * De band-variant is edge-to-edge bedoeld; de preview-decorator lijnt op `flex-start`,
 * dus de wrapper rekt hem hier expliciet op tot de volle breedte.
 */
export const Band: Story = {
  args: { options: detailTabs, value: 'splits', variant: 'band' },
  render: (args) => (
    <View style={{ alignSelf: 'stretch' }}>
      <Segmented {...args} />
    </View>
  ),
};

/** Edge case: `value` mag `null` zijn — geen enkel segment staat dan actief. */
export const GeenSelectie: Story = {
  args: { value: null },
};

/** Twee opties: de knoppen zijn `flex: 1`, dus elk de helft van de track. */
export const TweeOpties: Story = {
  args: {
    options: [
      { value: 'afstand', label: 'Afstand' },
      { value: 'tijd', label: 'Tijd' },
    ],
    value: 'afstand',
  },
};

/** Historiek-filter op afstand — het laatste segment staat actief. */
export const LaatsteActief: Story = {
  args: { options: afstandOpties, value: '5000' },
};

/**
 * Edge case: labels die breder zijn dan hun segment. `numberOfLines={1}` knipt af met
 * een ellips in plaats van te wrappen — dat moet zichtbaar blijven kloppen.
 */
export const LangeLabels: Story = {
  args: {
    options: [
      { value: 'gemiddelde-split', label: 'Gemiddelde split per 500 m' },
      { value: 'slagfrequentie', label: 'Slagfrequentie (spm)' },
    ],
    value: 'gemiddelde-split',
  },
};
