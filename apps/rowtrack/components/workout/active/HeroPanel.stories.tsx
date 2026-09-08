import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { HeroPanel } from './HeroPanel';

/**
 * `subtitle` is data, geen as: de drie vormen (progress, coaching-zin, kale waarde) horen elk
 * bij een ander doeltype en verschillen in inhoud, niet in een schakelaar. Ze staan daarom als
 * aparte stories in plaats van als variant-as.
 *
 * De decorator geeft het paneel een vaste maat: het is `flex`-gedreven in de app, en zonder
 * hoogte zou de centrering — het punt van dit component — niets te centreren hebben.
 */
const meta = {
  title: 'Componenten/HeroPanel',
  component: HeroPanel,
  decorators: [(Story) => <View style={{ width: 430, height: 487 }}><Story /></View>],
  argTypes: {
    heroLabel: { control: 'text' },
    heroText: { control: 'text' },
    subLabel: { control: 'text' },
    subtitle: { control: 'object' },
    style: { control: false },
  },
  args: {
    heroLabel: 'Resterende tijd',
    heroText: '11:16',
    subLabel: 'Afgelegd',
    subtitle: { kind: 'progress', left: '18:44', pct: 0.62 },
    style: { flex: 1, alignSelf: 'stretch' },
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2026-15640' },
  },
} satisfies Meta<typeof HeroPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Duurdoel: aftellende hero met een progress-subtitle. */
export const Playground: Story = {};

/** Geen doel: hero telt óp, en de subtitle is de kale afstand zonder eyebrow-percentage. */
export const ZonderDoel: Story = {
  args: {
    heroLabel: 'Totale tijd',
    heroText: '18:44',
    subLabel: 'Totale afstand',
    subtitle: { kind: 'plain', text: '5 000 m' },
  },
};

/** Splitdoel: geen tweede eyebrow, wél een coaching-zin met eigen horizontale inset. */
export const DoelSplit: Story = {
  args: {
    heroLabel: 'Huidige split',
    heroText: '1:52',
    subLabel: null,
    subtitle: { kind: 'sentence', text: 'Je bent 3 seconden sneller dan je doel' },
  },
};

/** De langste hero die voorkomt — het 114px-getal mag niet afbreken. */
export const LangeWaarde: Story = {
  args: { heroText: '1:59:59', subtitle: { kind: 'progress', left: '1:12:03', pct: 0.6 } },
};
