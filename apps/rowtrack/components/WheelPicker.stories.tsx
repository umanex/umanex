import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { WheelPicker } from './WheelPicker';
import { buildDistItems, buildDurItems, buildSplitItems, buildWattItems } from '@/lib/formatters';

/**
 * Twee assen: `surface` (de achtergrond-context waar fade en pill op afgestemd worden — de
 * sleutels van de interne SURFACE-map, dus `base` | `raised`) en `showPill`.
 *
 * `visibleRows` is een getal, geen literal-union: hij is een control maar géén as, anders zou
 * de guard in Figma een variant-property met een open getallenbereik moeten bouwen.
 * `items` is data (84 afstanden uit de echte builder) en `selectedIndex` de stand daarin —
 * allebei geen variant.
 *
 * De wheel is controlled: `onIndexChange` is hier een no-op, dus de rij die je uitkiest blijft
 * staan waar je hem loslaat en springt niet terug.
 */
const distItems = buildDistItems();
const splitItems = buildSplitItems();
const wattItems = buildWattItems();
const durItems = buildDurItems();

const meta = {
  title: 'Componenten/WheelPicker',
  component: WheelPicker,
  argTypes: {
    items: { control: false },
    selectedIndex: { control: 'number' },
    onIndexChange: { control: false },
    visibleRows: { control: 'number' },
    showPill: { control: 'boolean' },
    surface: { control: 'select', options: ['base', 'raised'] },
  },
  args: {
    items: distItems,
    selectedIndex: 3, // 2 km — de klassieke testafstand
    visibleRows: 5,
    showPill: true,
    surface: 'base',
    onIndexChange: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2028-17447' },
  },
} satisfies Meta<typeof WheelPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle args in meta. */
export const Playground: Story = {};

/**
 * Splittijden 1:30–3:00 per 500 m. Edge case: deze items hebben géén `unit`, dus het hele
 * label is de waarde en de kleine eenheid-tekst rechts valt weg.
 */
export const Splittijden: Story = {
  args: {
    items: splitItems,
    selectedIndex: 6, // 2:00 /500m
  },
};

/** Vermogen 50–500 W, stap 5 — geselecteerd op 210 watt. */
export const Vermogen: Story = {
  args: {
    items: wattItems,
    selectedIndex: 32, // 210 W
  },
};

/** Duur 5–180 min: vanaf een uur wordt het label "1 u 10 min", dus twee eenheden in één rij. */
export const Duur: Story = {
  args: {
    items: durItems,
    selectedIndex: 11, // 60 min
  },
};

/** De sheet-stand: drie rijen op een `raised` ondergrond, zoals de GoalSheet hem gebruikt. */
export const DrieRijenInSheet: Story = {
  args: {
    visibleRows: 3,
    surface: 'raised',
  },
};

/** Zonder eigen pill — voor een parent die één gedeelde selectieband over meerdere wheels tekent. */
export const ZonderPill: Story = {
  args: { showPill: false },
};

/** Edge case: bovenste waarde geselecteerd, dus boven de selectie staat alleen lege padding. */
export const EersteWaarde: Story = {
  args: { selectedIndex: 0 },
};

/** Edge case: onderste waarde (42 km) geselecteerd — de scroll kan niet verder. */
export const LaatsteWaarde: Story = {
  args: { selectedIndex: distItems.length - 1 },
};

/** Edge case: één enkele waarde — korter dan het aantal zichtbare rijen, dus niets te scrollen. */
export const EnkeleWaarde: Story = {
  args: {
    items: [{ label: '2 km', value: 2000, unit: 'km' }],
    selectedIndex: 0,
  },
};
