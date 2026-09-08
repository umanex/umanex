import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { BleStatusBar } from './BleStatusBar';

/**
 * `bleStatus` is de enige as. De component mapt de acht `ConnectionStatus`-waarden op vier
 * DeviceRow-vormen (verbonden · bezig · fout · rust); alle acht literals staan in de as, want
 * de as is het propcontract — niet het aantal zichtbare beelden.
 *
 * `deviceName` is een vrije string (nullable) en dus géén as: hij vult het label en valt bij
 * `null` terug op de i18n-tekst. Zelfde reden waarom `title` bij Button geen as is.
 */
const meta = {
  title: 'Componenten/BleStatusBar',
  component: BleStatusBar,
  argTypes: {
    bleStatus: {
      control: 'select',
      options: [
        'idle',
        'scanning',
        'connecting',
        'discovering',
        'connected',
        'disconnecting',
        'reconnecting',
        'error',
      ],
    },
    onConnect: { control: false },
    onDisconnect: { control: false },
  },
  args: {
    bleStatus: 'connected',
    deviceName: 'Concept2 PM5',
    onConnect: () => {},
    onDisconnect: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20%E2%80%94%20Design%20System?node-id=2004-4456' },
  },
} satisfies Meta<typeof BleStatusBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

export const Verbonden: Story = {
  args: { bleStatus: 'connected', deviceName: 'Concept2 PM5' },
};

export const Zoeken: Story = {
  args: { bleStatus: 'scanning', deviceName: null },
};

/** Bezig-toestand: spinner in plaats van de statusdot, actie uitgeschakeld. */
export const Verbinden: Story = {
  args: { bleStatus: 'connecting', deviceName: null },
};

export const Fout: Story = {
  args: { bleStatus: 'error', deviceName: null },
};

/** Ruststand — de tak waar `idle`, `disconnecting` en `reconnecting` samen in vallen. */
export const Inactief: Story = {
  args: { bleStatus: 'idle', deviceName: null },
};

/** Edge case: verbonden zonder dat de trainer een naam adverteert — label valt terug op i18n. */
export const GeenNaam: Story = {
  args: { bleStatus: 'connected', deviceName: null },
};

/** Edge case: het label staat op `numberOfLines={1}`, dus een lange naam hoort af te kappen. */
export const LangeApparaatnaam: Story = {
  args: { bleStatus: 'connected', deviceName: 'Concept2 PM5 — ergometer 3, clubzaal boven' },
};
