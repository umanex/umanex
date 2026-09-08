import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SplitsList } from './SplitsList';

/**
 * Geen variant-assen: `splits` is data, geen keuze uit een lijst. In Figma is dit één node
 * met een herhaalde chip erin.
 *
 * `split` is de tijd per 500 m in seconden (113,2 s → '1:52'); `watts` staat wél in het
 * type maar wordt niet getekend, dus hij verandert de render niet.
 */
const meta = {
  title: 'Componenten/SplitsList',
  component: SplitsList,
  args: {
    splits: [
      { distance: 500, split: 113.4, watts: 238 },
      { distance: 1000, split: 112.1, watts: 245 },
      { distance: 1500, split: 114.8, watts: 229 },
      { distance: 2000, split: 111.2, watts: 254 },
    ],
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2020-12432' },
  },
} satisfies Meta<typeof SplitsList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/**
 * Lege lijst: het component rendert `null`, dus deze story is bewust leeg. Dat is de
 * empty state — de kop 'SPLITS' zonder chips eronder zou erger zijn dan niets.
 */
export const Leeg: Story = {
  args: { splits: [] },
};

/** Eerste split binnen: één chip, de kop staat er al. */
export const EenSplit: Story = {
  args: { splits: [{ distance: 500, split: 115.6, watts: 224 }] },
};

/** Tien splits van een 5000 m — de rij scrollt horizontaal buiten beeld. */
export const LangeRit: Story = {
  args: {
    splits: [
      { distance: 500, split: 116.2, watts: 218 },
      { distance: 1000, split: 114.9, watts: 226 },
      { distance: 1500, split: 114.1, watts: 231 },
      { distance: 2000, split: 113.6, watts: 235 },
      { distance: 2500, split: 113.9, watts: 233 },
      { distance: 3000, split: 114.4, watts: 229 },
      { distance: 3500, split: 113.2, watts: 238 },
      { distance: 4000, split: 112.7, watts: 242 },
      { distance: 4500, split: 111.8, watts: 249 },
      { distance: 5000, split: 109.4, watts: 268 },
    ],
  },
};

/** Edge case: een split boven de tien minuten wordt breder dan de chip-inhoud ernaast. */
export const TrageSplit: Story = {
  args: {
    splits: [
      { distance: 500, split: 612.5, watts: 42 },
      { distance: 1000, split: 118.3, watts: 208 },
    ],
  },
};
