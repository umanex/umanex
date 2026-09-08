import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View, StyleSheet } from 'react-native';
import { space } from '@/constants';
import { KPI } from './KPI';

/**
 * De vier boolean-props zijn de variant-assen: `highlighted`, `compact`, `fill` en
 * `loading`. `label` en `value` zijn tekst-slots, geen as.
 *
 * `onPress` staat wél in de default-args, ook al is hij geen as: zonder handler rendert
 * KPI een kale `View` en leven de hoogte-varianten (`fill`, en de vaste 58px) niet — die
 * zitten allebei in de TouchableOpacity-tak. Met een handler is elke as echt te zien.
 */
const meta = {
  title: 'Componenten/KPI',
  component: KPI,
  argTypes: {
    highlighted: { control: 'boolean' },
    compact: { control: 'boolean' },
    fill: { control: 'boolean' },
    loading: { control: 'boolean' },
    onPress: { control: false },
  },
  args: {
    label: 'Split 500/m',
    value: '1:52',
    highlighted: false,
    compact: false,
    fill: false,
    loading: false,
    onPress: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2013-8648' },
  },
} satisfies Meta<typeof KPI>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** De waarde in accent — het doel is gehaald of de metric zit in de streefzone. */
export const Gemarkeerd: Story = {
  args: { label: 'Watt', value: '243', highlighted: true },
};

export const Compact: Story = {
  args: { label: 'SPM', value: '26', compact: true },
};

/** Laden: de waarde wijkt voor een spinner, het label blijft staan. */
export const Laden: Story = {
  args: { label: 'BPM', value: '148', loading: true },
};

/**
 * `fill` heeft alleen betekenis binnen een kolom die zelf een hoogte heeft — de
 * landscape-stack van het active-workout-scherm. Zonder die wrapper klapt een flex-kaart
 * dicht tot zijn minHeight, en dan toont de story de as niet.
 */
export const Vullend: Story = {
  args: { label: 'Totaal afstand', value: '5.000 m', fill: true },
  render: (args) => (
    <View style={styles.kolom}>
      <KPI {...args} />
    </View>
  ),
};

/** Nulwaarde bij een rit die net begonnen is — geen streepje, gewoon 0. */
export const Nulwaarde: Story = {
  args: { label: 'Totaal Kcal', value: '0' },
};

/** Edge case: label en waarde delen één regel met space-between; geen van beide mag wijken. */
export const LangLabel: Story = {
  args: { label: 'Gemiddelde split per 500 meter', value: '1:52' },
};

const styles = StyleSheet.create({
  kolom: {
    height: space['48'] * 3,
    width: space['48'] * 6,
  },
});
