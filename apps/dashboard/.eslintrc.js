// require.resolve i.p.v. de kale pakketnaam: ESLint 8 past op een `extends`-naam zijn
// eigen conventie toe en zoekt `@umanex/eslint-config-config`, wat niet bestaat. Een
// absoluut pad accepteert hij wel, en require.resolve gebruikt gewone Node-resolutie —
// dus geen ../../-pad dat breekt als de map verschuift.
module.exports = {
  extends: ['next/core-web-vitals', require.resolve('@umanex/config/eslint/tokens')],
};
