// MOET de eerste import blijven: ESM hijst imports, dus de body van dit bestand draait
// vóór die van preview.tsx én vóór elke lui geladen story-module — en dat is precies het
// venster waarin `StyleSheet.create` nog niet is aangeroepen. Zie het bestand zelf.
import './rnw-style-keys';
import type { Preview } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { bg } from '@/constants';
import './fonts.css';

/**
 * RowTrack is dark-only: `apps/rowtrack/tokens/tokens.json` heeft geen mode-as, dus er is
 * geen theme-toggle. Dezelfde regel als packages/rowtrack-tokens/build.mjs al toepast —
 * een light-variant bestaat niet in de bron en wordt hier niet verzonnen.
 */
const preview: Preview = {
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      // Een SCHERM-story rendert full-bleed op toestelmaat; alles anders houdt zijn eigen
      // maat met lucht eromheen. Zie .storybook/toestel.ts voor het waarom en de meting.
      const t = context.parameters?.toestel as { breedte: number; hoogte: number } | undefined;
      if (t) {
        return (
          <View style={{ backgroundColor: bg.base, width: t.breedte, height: t.hoogte, alignItems: 'stretch' }}>
            <Story />
          </View>
        );
      }
      return (
        <View style={{ backgroundColor: bg.base, padding: 24, alignItems: 'flex-start' }}>
          <Story />
        </View>
      );
    },
  ],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // De achtergrond komt uit de rollaag (bg.base); de backgrounds-toolbar zou daar een
    // tweede, token-loze bron naast zetten.
    backgrounds: { disable: true },
    options: {
      storySort: { order: ['Tokens', 'Componenten'] },
    },
  },
};

export default preview;
