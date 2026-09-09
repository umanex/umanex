import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { SubtitleProgress } from './SubtitleProgress';

/**
 * De rij is `alignSelf: 'stretch'` — hij vult het hero-paneel en verdeelt die breedte over
 * twee gelijke kolommen. Een decorator met een vaste breedte is daarom geen versiering maar
 * de voorwaarde om de spiegeling überhaupt te zien.
 */
const meta = {
  title: 'Componenten/SubtitleProgress',
  component: SubtitleProgress,
  decorators: [(Story) => <View style={{ width: 382 }}><Story /></View>],
  argTypes: {
    left: { control: 'text' },
    pct: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
  },
  args: { left: '18:44', pct: 0.62 },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2036-21912' },
  },
} satisfies Meta<typeof SubtitleProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Duurdoel op 62% — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Verse rit: 0% en een korte linkerwaarde. */
export const Start: Story = { args: { left: '0:00', pct: 0 } };

/** Afstandsdoel: de linkerwaarde draagt zijn eigen eenheid. */
export const Afstand: Story = { args: { left: '1 450 m', pct: 0.725 } };

/** Doel gehaald: 100%, en de langste linkerwaarde die voorkomt. */
export const Volbracht: Story = { args: { left: '1:59:59', pct: 1 } };
