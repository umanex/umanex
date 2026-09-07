import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fg, space, typeStyles } from '@/constants';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

const styles = StyleSheet.create({
  body: { gap: space['8'] },
  regel: {
    ...typeStyles.recentRow,
    color: fg.secondary,
  },
});

const inhoud = (
  <View style={styles.body}>
    <Text style={styles.regel}>Afstand · 2000 m</Text>
    <Text style={styles.regel}>Streefsplit · 1:52.4 / 500 m</Text>
    <Text style={styles.regel}>Slagfrequentie · 24 spm</Text>
  </View>
);

/**
 * `visible` is de enige as — een boolean-prop, dus per conventie een variant-as, ook al is de
 * `false`-kant een lege render (de Modal toont dan niets). `title` is een vrije string en
 * `children`/`footer` zijn slots, geen assen: in Figma horen die als instance-swap thuis, niet
 * als variant.
 *
 * De decorator is geen mock maar de échte provider: `BottomSheet` roept `useSafeAreaInsets()`
 * aan, en die gooit zonder `<SafeAreaProvider>` (react-native-safe-area-context 5.6.2,
 * SafeAreaContext.tsx r147). Op web is `initialWindowMetrics` null, dus de fallback in de
 * component levert `safeBottom = 0` — de geometrie is hier dus insets-vrij en deterministisch.
 */
const meta = {
  title: 'Componenten/BottomSheet',
  component: BottomSheet,
  decorators: [
    (Story) => (
      <SafeAreaProvider>
        <Story />
      </SafeAreaProvider>
    ),
  ],
  argTypes: {
    visible: { control: 'boolean' },
    onClose: { control: false },
    children: { control: false },
    footer: { control: false },
  },
  args: {
    visible: true,
    title: 'Doel instellen',
    onClose: () => {},
    children: inhoud,
  },
} satisfies Meta<typeof BottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Het gebruik uit profile.tsx: een vaste actie onder de scroll, buiten de body. */
export const MetFooter: Story = {
  args: {
    title: 'Trainingsdoel',
    footer: <Button title="Bewaren" onPress={() => {}} size="md" />,
  },
};

/** Edge case: body langer dan `maxHeight: 90%` — de ScrollView scrollt, de footer blijft staan. */
export const LangeContent: Story = {
  args: {
    title: 'Splits — 5000 m',
    footer: <Button title="Sluiten" onPress={() => {}} size="md" />,
    children: (
      <View style={styles.body}>
        {[
          '500 m · 1:52.4 · 24 spm · 212 W · 143 bpm',
          '1000 m · 1:54.1 · 23 spm · 201 W · 151 bpm',
          '1500 m · 1:55.8 · 22 spm · 194 W · 158 bpm',
          '2000 m · 1:56.2 · 22 spm · 191 W · 162 bpm',
          '2500 m · 1:55.0 · 23 spm · 197 W · 165 bpm',
          '3000 m · 1:54.6 · 24 spm · 199 W · 168 bpm',
          '3500 m · 1:53.9 · 24 spm · 203 W · 170 bpm',
          '4000 m · 1:53.1 · 25 spm · 208 W · 172 bpm',
          '4500 m · 1:52.0 · 27 spm · 216 W · 174 bpm',
          '5000 m · 1:48.3 · 31 spm · 241 W · 175 bpm',
        ].map((regel) => (
          <Text key={regel} style={styles.regel}>{regel}</Text>
        ))}
      </View>
    ),
  },
};

/** Edge case: de titel staat op `numberOfLines={1}` naast een vaste sluitknop. */
export const LangeTitel: Story = {
  args: { title: 'Streefsplit per 500 meter voor je 2000 m-test' },
};

/** Edge case: zonder footer eindigt de sheet direct onder de body. */
export const ZonderFooter: Story = {
  args: { footer: undefined },
};
