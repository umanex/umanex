import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { ProgressBar } from './ProgressBar';

/**
 * `richting` en `fillKind` zijn echte variant-assen: ze schakelen het beeld, niet de inhoud.
 * `fillPct` niet — dat is data.
 *
 * De decorator geeft de balk zijn ontbrekende as: horizontaal is hij `alignSelf: 'stretch'`
 * zonder eigen breedte, verticaal zonder eigen hoogte.
 */
const meta = {
  title: 'Componenten/ProgressBar',
  component: ProgressBar,
  decorators: [
    (Story, ctx) => (
      <View style={ctx.args.richting === 'v' ? { height: 240 } : { width: 430 }}>
        <Story />
      </View>
    ),
  ],
  argTypes: {
    fillKind: { control: 'select', options: ['none', 'gradient', 'success', 'warning'] },
    richting: { control: 'select', options: ['h', 'v'] },
    fillPct: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
  },
  args: { fillPct: 0.62, fillKind: 'gradient', richting: 'h' },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Duurdoel op 62%, portrait — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Landscape: dezelfde balk op zijn kant, gevuld van onder naar boven. */
export const Verticaal: Story = { args: { richting: 'v' } };

/** Geen doel: alleen de track, geen fill — ook niet bij een percentage boven nul. */
export const ZonderDoel: Story = { args: { fillKind: 'none' } };

/** Splitdoel gehaald: vol groen in plaats van geleidelijk. */
export const OpTempo: Story = { args: { fillKind: 'success', fillPct: 1 } };

/** Splitdoel niet gehaald: vol oranje. */
export const OnderTempo: Story = { args: { fillKind: 'warning', fillPct: 1 } };
