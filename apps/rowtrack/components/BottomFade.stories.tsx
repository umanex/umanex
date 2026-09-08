import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View, Text, StyleSheet } from 'react-native';
import { bg, fg, radii, space, typeStyles } from '@/constants';
import { BottomFade } from './BottomFade';

/**
 * BottomFade heeft géén variant-as: `height` is een getal en `style` een override, geen van
 * beide is een union of een boolean. In Figma is dit dus één node, geen component set.
 *
 * `height` blijft bewust uit `meta.args`, zodat Playground de component-default (64) meet in
 * plaats van een waarde die deze story verzint. De component is `position: absolute` en
 * `pointerEvents="none"`: hij neemt geen layout-ruimte in, dus in Playground plakt hij tegen
 * de onderrand van de preview-decorator. Hoe hij écht gebruikt wordt — over een scrollbare
 * lijst — staat in OverContent.
 */
const meta = {
  title: 'Componenten/BottomFade',
  component: BottomFade,
  argTypes: {
    height: { control: 'number' },
    style: { control: false },
  },
  args: {},
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20%E2%80%94%20Design%20System?node-id=2006-4508' },
  },
} satisfies Meta<typeof BottomFade>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Het echte gebruik: de fade dekt de onderste splits-regels van een lijst af. */
export const OverContent: Story = {
  render: (args) => (
    <View style={styles.lijst}>
      <Text style={styles.regel}>500 m · 1:52.4 · 24 spm</Text>
      <Text style={styles.regel}>1000 m · 1:54.1 · 23 spm</Text>
      <Text style={styles.regel}>1500 m · 1:55.8 · 22 spm</Text>
      <Text style={styles.regel}>2000 m · 1:51.6 · 26 spm</Text>
      <BottomFade {...args} />
    </View>
  ),
};

/** Kortere fade voor een lijst die dicht tegen een vaste knop eindigt. */
export const Laag: Story = {
  args: { height: space['24'] },
};

const styles = StyleSheet.create({
  lijst: {
    backgroundColor: bg.base,
    borderRadius: radii.md,
    paddingHorizontal: space['16'],
    paddingVertical: space['16'],
    gap: space['12'],
    overflow: 'hidden',
  },
  regel: {
    ...typeStyles.splitsRow,
    color: fg.secondary,
  },
});
