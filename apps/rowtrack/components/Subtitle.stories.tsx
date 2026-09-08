import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Subtitle } from './Subtitle';

/**
 * Subtitle heeft géén variant-as: `label` is tekst en `action` is een slot (label +
 * onPress + vast pijl-icoon), geen variant. In Figma is dat een boolean-property plus een
 * tekst-property op de instance — dezelfde behandeling als `icon` op Button.
 */
const meta = {
  title: 'Componenten/Subtitle',
  component: Subtitle,
  argTypes: {
    action: { control: false },
  },
  args: {
    label: 'Recente trainingen',
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2013-7951' },
  },
} satisfies Meta<typeof Subtitle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Met actie: de rij krijgt rechts een tekstlink met pijl (hitSlop 15/8, geen padding). */
export const MetActie: Story = {
  args: {
    action: { label: 'Alles bekijken', onPress: () => {} },
  },
};

/** Sectiekop boven de splits-tabel van een 2000m-rit, met doorklik naar het detail. */
export const MetSplitsActie: Story = {
  args: {
    label: 'Splits per 500 m',
    action: { label: 'Bekijk rit', onPress: () => {} },
  },
};

/**
 * Edge case: het label is `flex: 1` en wrapt, de actie blijft op één regel rechts staan
 * en lijnt op `flex-start` — dus bovenaan, niet gecentreerd op het gewrapte label.
 */
export const LangLabelMetActie: Story = {
  args: {
    label: 'Persoonlijke records op 2000 meter en 5000 meter',
    action: { label: 'Alles bekijken', onPress: () => {} },
  },
};
