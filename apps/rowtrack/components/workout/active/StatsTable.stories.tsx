import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { StatsTable } from './StatsTable';

/**
 * `rows` is data: het aantal regels en hun inhoud verschillen, niet het beeld. De laatste rij
 * krijgt geen hairline — dat is de enige positie-afhankelijke regel en hij wordt hier gemeten
 * doordat de stories verschillende rij-aantallen dragen.
 */
const meta = {
  title: 'Componenten/StatsTable',
  component: StatsTable,
  decorators: [(Story) => <View style={{ width: 430 }}><Story /></View>],
  argTypes: {
    rows: { control: 'object' },
    colAvg: { control: 'text' },
    colPeak: { control: 'text' },
  },
  args: {
    colAvg: 'Gemiddeld',
    colPeak: 'Piek',
    rows: [
      { label: 'Split', gem: '1:53', piek: '1:47' },
      { label: 'Watt', gem: '208', piek: '268' },
      { label: 'SPM', gem: '25', piek: '32' },
      { label: 'BPM', gem: '148', piek: '175' },
    ],
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2027-15964' },
  },
} satisfies Meta<typeof StatsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Vier regels — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Zonder hartslagband: BPM staat op "—" in beide kolommen. */
export const ZonderHartslag: Story = {
  args: {
    rows: [
      { label: 'Split', gem: '1:53', piek: '1:47' },
      { label: 'Watt', gem: '208', piek: '268' },
      { label: 'SPM', gem: '25', piek: '32' },
      { label: 'BPM', gem: '—', piek: '—' },
    ],
  },
};

/** Eén regel: geen enkele hairline, want er is geen volgende rij. */
export const EenRegel: Story = {
  args: { rows: [{ label: 'Split', gem: '1:53', piek: '1:47' }] },
};
