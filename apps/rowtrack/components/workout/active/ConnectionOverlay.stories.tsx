import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { ConnectionOverlay } from './ConnectionOverlay';

/**
 * `bleStatus` is de variant-as, maar met ZEVEN waarden en niet acht: `connected` ontbreekt
 * bewust. Bij verbinding bestaat deze overlay niet — ActivePhase rendert dan zijn layout — dus
 * een `connected`-variant zou een scherm tonen dat de app nooit laat zien. Het prop-type sluit
 * hem al uit; deze `options`-lijst zegt hetzelfde tegen de variant-as van de bouwspec.
 *
 * De decorator geeft de overlay een hoogte: hij is `flex: 1` en centreert verticaal, dus zonder
 * hoogte valt de centrering weg.
 */
const meta = {
  title: 'Componenten/ConnectionOverlay',
  component: ConnectionOverlay,
  decorators: [(Story) => <View style={{ width: 430, height: 640 }}><Story /></View>],
  argTypes: {
    bleStatus: {
      control: 'select',
      options: ['idle', 'scanning', 'connecting', 'discovering', 'disconnecting', 'reconnecting', 'error'],
    },
    bleError: { control: 'text' },
    elapsed: { control: 'text' },
    paddingHorizontal: { control: false },
    onRetry: { control: false },
    onStop: { control: false },
  },
  args: {
    bleStatus: 'connecting',
    bleError: null,
    elapsed: '18:44',
    paddingHorizontal: 24,
    onRetry: () => {},
    onStop: () => {},
  },
} satisfies Meta<typeof ConnectionOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Verbinden — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Fout: waarschuwingsicoon, de BLE-melding en Opnieuw naast de altijd aanwezige Stop. */
export const Fout: Story = {
  args: { bleStatus: 'error', bleError: 'Verbinding met de roeitrainer verbroken' },
};

/** Reconnect midden in een rit: de verstreken tijd loopt door onder de spinner. */
export const Herverbinden: Story = { args: { bleStatus: 'reconnecting', elapsed: '42:07' } };
