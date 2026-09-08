import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { TabLabel } from './TabLabel';
import { fg, accent, space } from '@/constants';

/**
 * `focused` is de enige boolean-prop en dus de variant-as. Let op: de component *leest*
 * hem niet — het design schrijft Albert Sans SemiBold 11px voor actief én inactief, en
 * het verschil komt binnen via `color` uit de tab-navigator. De as blijft staan omdat de
 * staat wél bestaat (actief/inactief tab); in Figma hangt het kleurverschil aan die as.
 *
 * `color` is een waarde, geen as: een select met kleurliteralen zou de rollaag dupliceren.
 */
const meta = {
  title: 'Componenten/TabLabel',
  component: TabLabel,
  argTypes: {
    focused: { control: 'boolean' },
    color: { control: 'color' },
  },
  args: {
    label: 'Training',
    focused: true,
    color: accent.default,
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20%E2%80%94%20Design%20System?node-id=2004-4500' },
  },
} satisfies Meta<typeof TabLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Inactieve tab: dezelfde typografie, `fg.tertiary` in plaats van accent. */
export const Inactief: Story = {
  args: { label: 'Historiek', focused: false, color: fg.tertiary },
};

/** De vier tabs van de app naast elkaar, met Training actief. */
export const Tabbalk: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', gap: space['24'] }}>
      <TabLabel {...args} label="Home" focused={false} color={fg.tertiary} />
      <TabLabel {...args} label="Training" focused color={accent.default} />
      <TabLabel {...args} label="Historiek" focused={false} color={fg.tertiary} />
      <TabLabel {...args} label="Profiel" focused={false} color={fg.tertiary} />
    </View>
  ),
};

/**
 * Edge case: een label dat breder is dan de tab. Er staat geen `numberOfLines`, dus het
 * wrapt — `maxFontSizeMultiplier={1.2}` begrenst enkel de schaal bij grote systeemtekst.
 */
export const LangLabel: Story = {
  args: { label: 'Persoonlijke records', focused: false, color: fg.tertiary },
};
