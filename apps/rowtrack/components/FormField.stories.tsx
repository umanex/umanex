import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { FormField } from './FormField';

/**
 * De argTypes met `options` of een boolean-control zijn de variant-assen waarop de
 * Figma-sync-guard joint. Hier is dat er één: `secureTextEntry` — die schakelt de
 * oog-knop in de rij en is dus een zichtbaar verschil.
 *
 * `keyboardType`, `autoCapitalize`, `autoComplete` en `autoCorrect` zijn bewust géén as.
 * Het zijn string-literal-unions respectievelijk booleans, maar ze sturen enkel het
 * toetsenbord van het toestel aan — de gerenderde node is voor elke waarde identiek.
 * Een as ervan maken zou in Figma tientallen variant-nodes opleveren die niet van elkaar
 * te onderscheiden zijn.
 *
 * `error` is een `string | null`, geen boolean: de foutstaat is een story (Fout), geen as.
 * De focus-rand is interne state (`useState`), geen prop, en dus niet stuurbaar vanuit een story.
 */
const meta = {
  title: 'Componenten/FormField',
  component: FormField,
  argTypes: {
    secureTextEntry: { control: 'boolean' },
    error: { control: 'text' },
    keyboardType: { control: false },
    autoCapitalize: { control: false },
    autoComplete: { control: false },
    autoCorrect: { control: false },
    onChangeText: { control: false },
    onBlur: { control: false },
  },
  args: {
    label: 'E-mailadres',
    value: 'jeroen@umanex.be',
    placeholder: 'jij@voorbeeld.be',
    secureTextEntry: false,
    error: null,
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoComplete: 'email',
    autoCorrect: false,
    onChangeText: () => {},
    onBlur: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2020-12371' },
  },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Wachtwoordveld: `secureTextEntry` maskeert de tekst én voegt de oog-knop toe. */
export const Wachtwoord: Story = {
  args: {
    label: 'Wachtwoord',
    value: 'roeien2000',
    placeholder: 'Minstens 8 tekens',
    secureTextEntry: true,
    keyboardType: 'default',
    autoComplete: 'current-password',
  },
};

/** Foutstaat: rode rand, accent-achtergrond en de melding onder het veld. */
export const Fout: Story = {
  args: {
    value: 'jeroen@umanex',
    error: 'Ongeldig e-mailadres',
  },
};

/** Leeg veld — enkel de placeholder in `fg.tertiary`. */
export const Leeg: Story = {
  args: { value: '' },
};

/** Edge case: `label` is optioneel; zonder label vervalt de bovenste regel volledig. */
export const ZonderLabel: Story = {
  args: { label: undefined },
};

/** Numerieke invoer zoals de doelafstand-velden in de goal-sheet. */
export const Afstand: Story = {
  args: {
    label: 'Doelafstand',
    value: '2000',
    placeholder: 'Afstand in meters',
    keyboardType: 'number-pad',
    autoComplete: 'off',
  },
};

/** Edge case: een label dat langer is dan de veldbreedte mag niet afknippen. */
export const LangLabel: Story = {
  args: {
    label: 'Gemiddelde 500m-split van je laatste training',
    value: '1:52.4',
    keyboardType: 'default',
  },
};
