import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { PrBanner } from './PrBanner';

/**
 * `prEntries` is data, geen as: het aantal records bepaalt zowel de koptekst (enkelvoud tegen
 * meervoud) als het aantal rijen. De lege lijst rendert niets — dat is geen empty state maar
 * de afwezigheid van een viering, en die hoort geen ruimte te nemen.
 */
const meta = {
  title: 'Componenten/PrBanner',
  component: PrBanner,
  decorators: [(Story) => <View style={{ width: 430 }}><Story /></View>],
  argTypes: { prEntries: { control: 'object' } },
  args: {
    prEntries: [{ metric: 'watts', value: 143, previous: 138, previous_at: '2026-08-12' }],
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2027-15905' },
  },
} satisfies Meta<typeof PrBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Eén record — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Drie records: de koptekst gaat naar het meervoud en de rijen stapelen. */
export const Meerdere: Story = {
  args: {
    prEntries: [
      { metric: 'watts', value: 143, previous: 138, previous_at: '2026-08-12' },
      { metric: 'distance', value: 12500, previous: 11800, previous_at: '2026-07-30' },
      { metric: 'best2k', value: 468, previous: 481, previous_at: '2026-06-04' },
    ],
  },
};

/** Eerste keer: bekend als record, maar de herkomst is onbekend (`previous: null`). */
export const ZonderVorige: Story = {
  args: { prEntries: [{ metric: 'split', value: 108, previous: null, previous_at: null }] },
};
