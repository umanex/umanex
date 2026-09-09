/**
 * `dataSet` bestaat wél in react-native-web maar niet in de types van react-native.
 *
 * WAAROM WE HEM GEBRUIKEN. Een node die Reanimated inline stylet (`useAnimatedStyle`,
 * `entering=`) heeft geen StyleSheet-sleutel om op te matchen: Reanimated plat de style-array
 * tot een inline attribuut, dus de laagnaam-pas valt daar terug op een structurele naam.
 * Gemeten 2026-09-08: 153 van de sleutelloze nodes komen uit die drie plekken.
 * `dataSet={{ laag: 'bigLayer' }}` geeft ze alsnog een naam uit de code.
 *
 * DAT HET AANKOMT is gelezen in de geïnstalleerde bron, niet aangenomen:
 *  · react-native-web 0.21.2 `modules/createDOMProps/index.js:756-766` schrijft elke sleutel
 *    van `dataSet` als `data-<gehypheneerde-naam>`; `{ laag: 'x' }` wordt dus `data-laag="x"`.
 *  · react-native-reanimated 4.1.7 `createAnimatedComponent/PropsFilter.js` geeft in zijn
 *    laatste `else` elke onbekende prop ongewijzigd door.
 *
 * WAAROM EEN AUGMENTATIE EN GEEN CAST. Een `as any` op de call-site verbergt precies één
 * typefout per plek en zegt niets over waaróm het mag; deze declaratie zegt het één keer, met
 * de bron erbij. Zowel `ViewProps` als `TextProps` — gemeten: `Animated.Text` in GoalSegments
 * faalt anders even hard als `Animated.View`.
 *
 * OP NATIVE reist de prop mee naar de view manager. iOS en Android negeren een onbekende prop
 * stil; komt er ooit een waarschuwing in de dev-client, dan is dít het bestand dat de reden
 * draagt.
 */
declare module 'react-native' {
  interface ViewProps {
    dataSet?: Record<string, string>;
  }
  interface TextProps {
    dataSet?: Record<string, string>;
  }
  // Ook de raakbare wrappers: `TouchableOpacity` en `Pressable` erven ViewProps niet in de
  // types, dus zonder deze twee faalt precies de wortel van Button, Chip en KpiRow.
  interface TouchableOpacityProps {
    dataSet?: Record<string, string>;
  }
  interface PressableProps {
    dataSet?: Record<string, string>;
  }
}

export {};
