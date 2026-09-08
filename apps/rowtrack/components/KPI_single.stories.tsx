import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { KpiSingle } from './KPI_single';

/**
 * Geen variant-assen. `value`, `unit` en `label` zijn tekst-slots en `style` is de
 * layout-haak van de parent (de 2×2-grid in het detailscherm), geen eigenschap van het
 * component zelf. In Figma hoort hier dus één node zonder variant-as — dat is de juiste
 * uitkomst, geen vergeten as.
 *
 * `unit` is optioneel: ontbreekt hij, dan vervalt de tweede tekst in de waarde-rij. Dat is
 * een zichtbaar verschil, maar het hangt aan de aanwezigheid van data en niet aan een
 * keuze uit een lijst — vandaar een aparte story in plaats van een as.
 */
const meta = {
  title: 'Componenten/KpiSingle',
  component: KpiSingle,
  argTypes: {
    style: { control: false },
  },
  args: {
    value: '5.000',
    unit: 'm',
    label: 'Totaal afstand',
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2008-4772' },
  },
} satisfies Meta<typeof KpiSingle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Duur draagt zijn eenheid in de notatie zelf — de unit-tekst valt weg. */
export const ZonderEenheid: Story = {
  args: { value: '24:31', unit: undefined, label: 'Totale duur' },
};

/** Split per 500 m: waarde en eenheid staan op de baseline uitgelijnd. */
export const Split: Story = {
  args: { value: '1:52', unit: '/500m', label: 'Gemiddelde split' },
};

/** Een rit zonder gemeten waarde toont een streepje met een lege eenheid. */
export const OntbrekendeWaarde: Story = {
  args: { value: '—', unit: '', label: 'Totaal slagen' },
};

/** Nulwaarde: het PR-blok op het homescherm vóór de eerste rit. */
export const Nulwaarde: Story = {
  args: { value: '0', unit: 'km', label: 'Verste afstand' },
};

/** Edge case: het label loopt breder dan de waarde en bepaalt dan de kolombreedte. */
export const LangLabel: Story = {
  args: { value: '243', unit: 'W', label: 'Gemiddeld vermogen over de volledige rit' },
};
