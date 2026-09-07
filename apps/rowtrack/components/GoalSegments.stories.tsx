import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { GoalSegments } from './GoalSegments';

/**
 * `selected` is de enige as: de vijf doeltypes uit `GoalSegmentType` (`GoalType` + `'none'`).
 * Het icoon per segment is een vaste map in de component, geen prop — dus geen slot en geen as.
 *
 * De band vult de breedte van zijn ouder; de bleed is de taak van het scherm eromheen. In
 * Storybook is die ouder het canvas, dus de segmenten verdelen zich over de volle breedte.
 */
const meta = {
  title: 'Componenten/GoalSegments',
  component: GoalSegments,
  argTypes: {
    selected: {
      control: 'select',
      options: ['none', 'duration', 'distance', 'split', 'watts'],
    },
    onChange: { control: false },
  },
  args: {
    selected: 'distance',
    onChange: () => {},
  },
} satisfies Meta<typeof GoalSegments>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle args in meta. */
export const Playground: Story = {};

/** Standaardstand van een vrije roeisessie: geen doel, alleen het oneindig-icoon actief. */
export const GeenDoel: Story = { args: { selected: 'none' } };

/** Duur-doel actief (bv. 24:31 varen) — het langste label van de vijf. */
export const Duur: Story = { args: { selected: 'duration' } };

/** Afstand-doel actief (bv. 2000 m). */
export const Afstand: Story = { args: { selected: 'distance' } };

/**
 * Split-doel actief (bv. 1:52.4 per 500 m). Laatste twee segmenten: hier liep het actieve
 * segment vroeger van het scherm af, dus deze twee stories zijn de meetbare kant van die fix.
 */
export const Split: Story = { args: { selected: 'split' } };

/** Vermogen-doel actief (bv. 210 watt) — het meest rechtse segment. */
export const Watt: Story = { args: { selected: 'watts' } };

/** Alle vijf standen onder elkaar: toont hoe de inactieve segmenten meekrimpen. */
export const AlleStanden: Story = {
  render: (args) => (
    <>
      <GoalSegments {...args} selected="none" />
      <GoalSegments {...args} selected="duration" />
      <GoalSegments {...args} selected="distance" />
      <GoalSegments {...args} selected="split" />
      <GoalSegments {...args} selected="watts" />
    </>
  ),
};
