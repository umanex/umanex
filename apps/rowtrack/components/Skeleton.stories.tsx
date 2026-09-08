import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, Text, View } from 'react-native';
import { body, display, fg, mono, space } from '@/constants';
import { Skeleton } from './Skeleton';

/**
 * Geen variant-assen: `children` is een slot en `style` een override — in Figma dus één vorm
 * zonder variant-properties, en de maat komt daar net als hier uit de inhoud.
 *
 * Skeleton ontleent zijn afmeting aan het kind dat er straks staat en rendert dat kind
 * onzichtbaar mee. Elke story zet er daarom échte inhoud in op de juiste typeStyle; een lege
 * Skeleton zou een blok van nul bij nul zijn.
 */
const styles = StyleSheet.create({
  value: { ...display.sm, color: fg.primary },
  split: { ...mono.lg, color: fg.primary },
  regel: { ...body.md, color: fg.secondary },
  blok: { gap: space['8'] },
});

const meta = {
  title: 'Componenten/Skeleton',
  component: Skeleton,
  argTypes: {
    children: { control: false },
    style: { control: false },
  },
  args: {
    children: <Text style={styles.value}>2.000 m</Text>,
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2020-12310' },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Smal kind: de placeholder krimpt mee tot de breedte van één split-waarde. */
export const SplitWaarde: Story = {
  args: { children: <Text style={styles.split}>1:52.4</Text> },
};

/** Meerdere regels: de placeholder dekt het hele blok, niet regel per regel. */
export const Tekstblok: Story = {
  args: {
    children: (
      <View style={styles.blok}>
        <Text style={styles.value}>24:31</Text>
        <Text style={styles.regel}>5.000 m · 26 spm · 148 bpm</Text>
      </View>
    ),
  },
};
