import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { HrStatusBar } from './HrStatusBar';

/**
 * `hrStatus` is de enige as — de vijf waarden van `HRStatus` uit `lib/ble/types.ts`.
 * `hrDeviceName` is een tekst-slot: valt hij weg, dan schrijft het component zelf een
 * generieke naam in.
 *
 * Let op: `error` heeft géén eigen tak in het component en valt door naar dezelfde rij als
 * `idle`. Die story staat er daarom expliciet in — hij is niet vergeten, hij is (nog)
 * identiek, en dat is precies wat een parity-vergelijking moet kunnen zien.
 */
const meta = {
  title: 'Componenten/HrStatusBar',
  component: HrStatusBar,
  argTypes: {
    hrStatus: { control: 'select', options: ['idle', 'scanning', 'waiting', 'connected', 'error'] },
    onConnect: { control: false },
    onDisconnect: { control: false },
  },
  args: {
    hrStatus: 'idle',
    hrDeviceName: null,
    onConnect: () => {},
    onDisconnect: () => {},
  },
} satisfies Meta<typeof HrStatusBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Zoeken: spinner in plaats van het hart, en de actie is niet aanklikbaar. */
export const Zoeken: Story = {
  args: { hrStatus: 'scanning' },
};

/**
 * Verbonden maar nog geen hartslag binnen. Bewust oranje en niet groen: groen betekent
 * "het werkt", en dat is hier juist wat we niet weten.
 */
export const Wachten: Story = {
  args: { hrStatus: 'waiting', hrDeviceName: 'Polar H10' },
};

/** Verbonden: groen hart, actie wordt 'Verbreken'. */
export const Verbonden: Story = {
  args: { hrStatus: 'connected', hrDeviceName: 'Polar H10' },
};

/** Edge case: verbonden zonder bekende toestelnaam — het component vult 'HR verbonden' in. */
export const VerbondenZonderNaam: Story = {
  args: { hrStatus: 'connected', hrDeviceName: null },
};

/** Fout: valt terug op de verbind-rij, zodat opnieuw proberen één tik blijft. */
export const Fout: Story = {
  args: { hrStatus: 'error' },
};

/** Edge case: een lange toestelnaam staat op `numberOfLines={1}` en kapt af. */
export const LangeToestelnaam: Story = {
  args: { hrStatus: 'connected', hrDeviceName: 'Garmin HRM-Pro Plus borstband van Jeroen' },
};
