import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { SummaryTitle } from './SummaryTitle';

/**
 * `dateLabel` staat op een VASTE waarde en niet op de echte klok. Dat is de reden dat het een
 * prop is: zolang ActivePhase hem uit `new Date()` haalde, verschilde deze node tussen twee
 * metingen en stond hij in `figma/niet-reproduceerbaar.json`.
 */
const meta = {
  title: 'Componenten/SummaryTitle',
  component: SummaryTitle,
  decorators: [(Story) => <View style={{ width: 430 }}><Story /></View>],
  argTypes: {
    title: { control: 'text' },
    dateLabel: { control: 'text' },
    paddingTop: { control: false },
  },
  args: { title: 'Samenvatting', dateLabel: 'Vandaag - 18:44', paddingTop: 28 },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2027-15891' },
  },
} satisfies Meta<typeof SummaryTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint. */
export const Playground: Story = {};

/** Een middernacht-tijd: één cijfer minder in het uur mag de regel niet laten springen. */
export const Middernacht: Story = { args: { dateLabel: 'Vandaag - 0:07' } };
