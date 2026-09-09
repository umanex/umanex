import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { StartCta } from './StartCta';

/**
 * Eén knop in een zone met vaste paddings — geen assen en geen data. De story bestaat omdat de
 * zone zelf een maat heeft die in het scherm meetelt, niet omdat de knop varianten heeft.
 */
const meta = {
  title: 'Componenten/StartCta',
  component: StartCta,
  decorators: [(Story) => <View style={{ width: 430 }}><Story /></View>],
  argTypes: { onStart: { control: false } },
  args: { onStart: () => {} },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2028-17065' },
  },
} satisfies Meta<typeof StartCta>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint. */
export const Playground: Story = {};
