import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { ActiveHeader } from './ActiveHeader';

/**
 * `paddings` staat op de portrait-waarden zonder notch: Storybook heeft er geen, en een
 * safe-area is een toestelmaat en geen designtoken (zelfde regel als `insets` in de
 * scherm-stories). De landscape-story toont de asymmetrie die de prop bestaansrecht geeft.
 */
const meta = {
  title: 'Componenten/ActiveHeader',
  component: ActiveHeader,
  decorators: [(Story) => <View style={{ width: 430 }}><Story /></View>],
  argTypes: {
    goal: { control: 'object' },
    paddings: { control: 'object' },
    onStop: { control: false },
  },
  args: {
    goal: { type: 'duration', target: 1800 },
    onStop: () => {},
    paddings: { top: 20, bottom: 20, left: 24, right: 24 },
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2026-15654' },
  },
} satisfies Meta<typeof ActiveHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Portrait met een duurdoel — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Geen doel: de pill toont "Geen" en de band houdt dezelfde hoogte. */
export const ZonderDoel: Story = { args: { goal: null } };

/** Landscape: links de safe-area, rechts een vaste 40 naar de progress-bar. */
export const Landscape: Story = {
  args: { paddings: { top: 20, bottom: 20, left: 20, right: 40 } },
};
