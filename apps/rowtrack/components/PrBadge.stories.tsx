import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { PrBadge } from './PrBadge';

/**
 * `size` is de enige as. `label` is een tekst-slot: `null` of weglaten betekent "toon de
 * kale PR-badge", niet een aparte variant — de badge blijft dezelfde node met andere
 * tekst. De labels hieronder komen uit `formatPrCompact` in `lib/prDisplay.ts`, dus dit
 * zijn de vormen die echt in de app verschijnen.
 */
const meta = {
  title: 'Componenten/PrBadge',
  component: PrBadge,
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
  },
  args: {
    label: '2K 7:42',
    size: 'md',
  },
} satisfies Meta<typeof PrBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/**
 * `sm` staat in een archiefrij en heeft daarom géén verticale padding — de rijhoogte hangt
 * aan de datumregel ernaast, niet aan de badge.
 */
export const Klein: Story = {
  args: { label: '243 W', size: 'sm' },
};

/** Record zonder bekende metric (ritten van vóór `workouts.pr_metrics`): kale 'PR'-badge. */
export const ZonderLabel: Story = {
  args: { label: null },
};

/** Meerdere records op één rit — dan draagt de badge het aantal in plaats van de metric. */
export const MeerdereRecords: Story = {
  args: { label: '3 records' },
};

/** Split-record: de eenheid hoort bij het label, anders leest '1:52' als een 2K-tijd. */
export const SplitRecord: Story = {
  args: { label: '1:52 /500m', size: 'sm' },
};

/** Edge case: de tekst staat op `numberOfLines={1}`, dus een te lang label kapt af. */
export const LangLabel: Story = {
  args: { label: '2K 7:42 · 1:52 /500m · 243 W', size: 'sm' },
};
