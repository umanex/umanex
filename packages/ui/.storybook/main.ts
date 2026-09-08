import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../docs/**/*.mdx', '../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-themes'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  /**
   * RowTrack hangt hier als `ref`, niet als tweede losse installatie.
   *
   * CLAUDE.md → Design-systeem-bron: een app met een eigen tokenbron verantwoordt een eigen
   * componentlaag, en de vorm daarvan is een eigen Storybook die híer als ref hangt. RowTrack
   * heeft die eigen bron (`apps/rowtrack/tokens/tokens.json`, dark-only, geen Tailwind) en
   * rendert React Native via react-native-web — een andere framework-builder, dus samenvoegen
   * in één Storybook kan niet.
   *
   * De ref wijst naar de dev-server op :6007. Draait die niet, dan toont Storybook de ref als
   * niet-beschikbaar in plaats van om te vallen; start hem met
   * `pnpm --filter rowtrack storybook`.
   */
  refs: {
    rowtrack: {
      title: 'RowTrack (mobile)',
      url: 'http://localhost:6007',
      expanded: false,
    },
  },
};

export default config;
