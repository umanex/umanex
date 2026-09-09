import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { DeviceSelectionModal } from './DeviceSelectionModal';
import type { FoundDevice } from '@/lib/ble/types';

/**
 * De argTypes met `options` of een boolean-control zijn de variant-assen: `kind` (roeitrainer
 * vs. hartslagmeter — bepaalt titel én rij-icoon) en `visible`.
 *
 * `visible` staat in de default args op `true`: dit is een bottom sheet in een `Modal`, dus
 * op `false` rendert de story een leeg kader.
 *
 * `devices` is data, geen as. De signaallabels komen uit de RSSI-drempels in het component:
 * boven −60 "Sterk", −60 t/m −80 "Goed", daaronder "Zwak" — de lijst hieronder raakt alle drie.
 */
const roeitrainers: FoundDevice[] = [
  { id: 'pm5-4821', name: 'Concept2 PM5 4821', rssi: -48 },
  { id: 's4-0118', name: 'WaterRower S4', rssi: -72 },
  { id: 'pm5-9033', name: 'Concept2 PM5 9033', rssi: -91 },
];

const hartslagbanden: FoundDevice[] = [
  { id: 'polar-h10', name: 'Polar H10 8A2F41', rssi: -52 },
  { id: 'hrm-pro', name: 'Garmin HRM-Pro 3117', rssi: -77 },
];

const meta = {
  title: 'Componenten/DeviceSelectionModal',
  component: DeviceSelectionModal,
  argTypes: {
    visible: { control: 'boolean' },
    kind: { control: 'select', options: ['rower', 'hr'] },
    devices: { control: 'object' },
    onSelect: { control: false },
    onCancel: { control: false },
  },
  args: {
    visible: true,
    kind: 'rower',
    devices: roeitrainers,
    onSelect: () => {},
    onCancel: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2036-20889' },
  },
} satisfies Meta<typeof DeviceSelectionModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle args in meta. */
export const Playground: Story = {};

/** Hartslagmeter-scan: andere titel, hart-icoon per rij in plaats van het boot-icoon. */
export const Hartslagmeter: Story = {
  args: { kind: 'hr', devices: hartslagbanden },
};

/**
 * Leeg: de scan liep maar vond niets. De sheet houdt titel en Annuleren, de lijst is leeg —
 * er is bewust geen lege-toestand-tekst in het component, dus dit toont wat de roeier ziet.
 */
export const Leeg: Story = {
  args: { devices: [] },
};

/** Eén trainer, ver weg: alles onder −80 dBm leest als "Zwak" in de foutkleur. */
export const ZwakSignaal: Story = {
  args: {
    devices: [{ id: 'pm5-2210', name: 'Concept2 PM5 2210', rssi: -95 }],
  },
};

/** Edge case: de naam is op één regel afgekapt (`numberOfLines={1}`), het signaal blijft leesbaar. */
export const LangeToestelnaam: Story = {
  args: {
    devices: [
      { id: 'pm5-lang', name: 'Concept2 PM5 — Roeizaal boven, ergometer 4821', rssi: -58 },
      ...roeitrainers.slice(1),
    ],
  },
};
