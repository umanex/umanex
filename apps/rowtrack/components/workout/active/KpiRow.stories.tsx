import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { KpiRow } from './KpiRow';

/**
 * Vier booleans, en alle vier zijn ze echte variant-assen: ze schakelen het beeld (hoogte,
 * hairline, spinner, dimming), niet de inhoud. `label` en `value` zijn data en worden slots.
 *
 * De decorator geeft de rij een breedte — hij verdeelt label en waarde over
 * `space-between`, en zonder breedte staan ze tegen elkaar.
 */
const meta = {
  title: 'Componenten/KpiRow',
  component: KpiRow,
  decorators: [(Story) => <View style={{ width: 382 }}><Story /></View>],
  argTypes: {
    label: { control: 'text' },
    value: { control: 'text' },
    fill: { control: 'boolean' },
    divider: { control: 'boolean' },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onPress: { control: false },
  },
  args: {
    label: 'Split',
    value: '1:52',
    fill: false,
    divider: true,
    loading: false,
    disabled: false,
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2036-22083' },
  },
} satisfies Meta<typeof KpiRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Portrait, met hairline — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** De laatste rij van een lijst: geen hairline eronder. */
export const Laatste: Story = { args: { divider: false } };

/** De BPM-rij zonder band: tikbaar om alsnog te scannen. */
export const Tikbaar: Story = { args: { label: 'BPM', value: '—', onPress: () => {} } };

/** Zoekend naar een band: spinner in plaats van de waarde, en niet tikbaar. */
export const Zoekend: Story = {
  args: { label: 'BPM', value: '—', loading: true, disabled: true, onPress: () => {} },
};
