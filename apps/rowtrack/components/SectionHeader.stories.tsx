import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SectionHeader } from './SectionHeader';

/**
 * SectionHeader heeft één prop (`title`) en dus géén variant-as: in Figma is dit één
 * component met een tekst-property, geen component set. De hoofdletters komen uit
 * `label.caps` (`textTransform: 'uppercase'`), niet uit de doorgegeven string — de
 * stories schrijven de titel daarom in gewone spelling.
 */
const meta = {
  title: 'Componenten/SectionHeader',
  component: SectionHeader,
  args: {
    title: 'Recente trainingen',
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2016-11105' },
  },
} satisfies Meta<typeof SectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Kortst voorkomende kop — de letterspacing van 1.8 blijft ook hier zichtbaar. */
export const KorteTitel: Story = {
  args: { title: 'Splits' },
};

/** Edge case: de kop wrapt over twee regels; `label.caps` heeft lineHeight 15. */
export const LangeTitel: Story = {
  args: { title: 'Persoonlijke records op 2000 en 5000 meter' },
};
