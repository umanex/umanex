import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Icon } from './Icon';
import { fg, accent, space } from '@/constants';

/**
 * Icon heeft géén variant-as: `name`, `size` en `color` zijn waarden, geen varianten.
 * In Figma is dit één instance-swap-slot met een kleur- en groottebinding, niet een
 * component set — een as per Ionicons-naam zou duizenden variant-nodes betekenen.
 * Daarom staat `name` op `control: false`, conform de regel voor Ionicons-namen.
 *
 * De maten hieronder komen uit `space`, niet uit losse getallen: een px-waarde die niet
 * uit de tokenlaag komt hoort ook in een story niet thuis.
 */
const meta = {
  title: 'Componenten/Icon',
  component: Icon,
  argTypes: {
    name: { control: false },
    size: { control: 'number' },
    color: { control: 'color' },
  },
  args: {
    name: 'stopwatch-outline',
    size: space['24'],
    color: fg.primary,
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2036-20764' },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Grote weergave zoals in de lege-staat-illustraties. */
export const Groot: Story = {
  args: { name: 'boat-outline', size: space['48'] },
};

/** Kleine weergave zoals inline naast een label of KPI. */
export const Klein: Story = {
  args: { name: 'flame-outline', size: space['16'] },
};

/** Gedempt: dezelfde glyph in `fg.tertiary` voor secundaire rijen. */
export const Gedempt: Story = {
  args: { name: 'bluetooth-outline', color: fg.tertiary },
};

/** Accentkleur — de staat die "verbonden" of "record" markeert. */
export const Accent: Story = {
  args: { name: 'trophy-outline', color: accent.default },
};

/** De iconen die in de roei-schermen terugkomen, op één rij ter vergelijking. */
export const Roeiset: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', gap: space['16'], alignItems: 'center' }}>
      <Icon {...args} name="boat-outline" />
      <Icon {...args} name="stopwatch-outline" />
      <Icon {...args} name="speedometer-outline" />
      <Icon {...args} name="heart-outline" />
      <Icon {...args} name="flame-outline" />
      <Icon {...args} name="bluetooth-outline" />
    </View>
  ),
};
