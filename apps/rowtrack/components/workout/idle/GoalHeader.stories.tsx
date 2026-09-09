import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { GoalHeader } from './GoalHeader';

/**
 * `selectedSegment` is de variant-as. `screenWidth` staat op de iPhone-breedte en op
 * `control: false`: het is een toestelmaat, geen ontwerpkeuze — dezelfde regel als de insets in
 * de scherm-stories.
 *
 * De decorator draagt de horizontale padding van het startscherm, want zonder die padding is er
 * niets waar de negatieve marge tegenaan werkt en is de full-bleed-truc onzichtbaar.
 */
const meta = {
  title: 'Componenten/GoalHeader',
  component: GoalHeader,
  decorators: [(Story) => <View style={{ width: 430, paddingHorizontal: 24, overflow: 'hidden' }}><Story /></View>],
  argTypes: {
    selectedSegment: { control: 'select', options: ['none', 'duration', 'distance', 'split', 'watts'] },
    screenWidth: { control: false },
    onChange: { control: false },
  },
  args: { selectedSegment: 'duration', screenWidth: 430, onChange: () => {} },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2036-23333' },
  },
} satisfies Meta<typeof GoalHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Duurdoel geselecteerd — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Geen doel: het eerste segment is actief en de picker eronder valt weg. */
export const Geen: Story = { args: { selectedSegment: 'none' } };
