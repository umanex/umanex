import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { DeviceSection } from './DeviceSection';

/**
 * `bleStatus` en `hrStatus` zijn de variant-assen — samen 40 combinaties, en die zijn ook echt
 * onafhankelijk: de trainer en de hartslagband verbinden los van elkaar. `hrError` is geen as
 * maar data: hij hangt aan één specifieke `hrStatus` en staat als eigen story.
 */
const meta = {
  title: 'Componenten/DeviceSection',
  component: DeviceSection,
  decorators: [(Story) => <View style={{ width: 382 }}><Story /></View>],
  argTypes: {
    bleStatus: {
      control: 'select',
      options: ['idle', 'scanning', 'connecting', 'discovering', 'connected', 'disconnecting', 'reconnecting', 'error'],
    },
    hrStatus: { control: 'select', options: ['idle', 'scanning', 'waiting', 'connected', 'error'] },
    deviceName: { control: 'text' },
    hrDeviceName: { control: 'text' },
    hrError: { control: 'text' },
    onConnect: { control: false },
    onDisconnect: { control: false },
    onHRConnect: { control: false },
    onHRDisconnect: { control: false },
  },
  args: {
    bleStatus: 'connected',
    deviceName: 'Concept2 PM5 4821',
    hrStatus: 'connected',
    hrDeviceName: 'Polar H10',
    hrError: null,
    onConnect: () => {},
    onDisconnect: () => {},
    onHRConnect: () => {},
    onHRDisconnect: () => {},
  },
} satisfies Meta<typeof DeviceSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Beide verbonden — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Niets verbonden: twee "Verbinden"-rijen onder elkaar. */
export const NietVerbonden: Story = {
  args: { bleStatus: 'idle', deviceName: null, hrStatus: 'idle', hrDeviceName: null },
};

/** Gefaalde hartslag-scan: de foutzin onder de kaart, zonder welke de rij een dode knop lijkt. */
export const HartslagFout: Story = {
  args: { hrStatus: 'error', hrDeviceName: null, hrError: 'Geen hartslagband gevonden' },
};
