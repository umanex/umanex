import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { SummaryKpiBand } from './SummaryKpiBand';

/**
 * `kpis` is data: de vier tegels verschillen in inhoud, niet in een schakelaar. De tuple ligt
 * vast op vier — twee rijen van twee is de vorm van het ontwerp, geen limiet die we kozen.
 */
const meta = {
  title: 'Componenten/SummaryKpiBand',
  component: SummaryKpiBand,
  decorators: [(Story) => <View style={{ width: 430 }}><Story /></View>],
  argTypes: { kpis: { control: 'object' } },
  args: {
    kpis: [
      { value: '5,0', unit: 'km', label: 'Afstand' },
      { value: '18:44', label: 'Duur' },
      { value: '238', unit: 'kcal', label: 'Energie' },
      { value: '486', label: 'Halen' },
    ],
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2036-22209' },
  },
} satisfies Meta<typeof SummaryKpiBand>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint. */
export const Playground: Story = {};

/** Zonder profielgewicht is kcal een schatting — de waarde krijgt een sterretje. */
export const ZonderProfielgewicht: Story = {
  args: {
    kpis: [
      { value: '5,0', unit: 'km', label: 'Afstand' },
      { value: '18:44', label: 'Duur' },
      { value: '238*', unit: 'kcal', label: 'Energie' },
      { value: '486', label: 'Halen' },
    ],
  },
};

/** Ontbrekende halen (geen trainer-data) tonen "—", niet "0". */
export const Onbekend: Story = {
  args: {
    kpis: [
      { value: '312', unit: 'm', label: 'Afstand' },
      { value: '1:04', label: 'Duur' },
      { value: '9', unit: 'kcal', label: 'Energie' },
      { value: '—', label: 'Halen' },
    ],
  },
};
