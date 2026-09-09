import { Children, cloneElement, isValidElement, useEffect, type ReactNode } from 'react';

/**
 * Storybook-mock voor `expo-router`.
 *
 * WAAROM DIT BESTAAT. De zeven route-schermen (vier auth-schermen, profile, history/index,
 * history/[id]) importeren `useRouter`, `Link`, `useLocalSearchParams` en `Stack`. Zonder
 * router-context gooit `useRouter` bij de eerste render en blijft het scherm leeg — met één
 * console-fout als enige signaal, dezelfde vorm als de supabase-val van 2026-09-07.
 *
 * WAT DE MOCK DOET EN NIET DOET. Navigeren gebeurt NIET: `router.push` en broers loggen naar
 * de console en veranderen niets. Een story is een statische weergave (besluit 4 van de
 * briefing: geen prototype-bedrading), en een echte navigatie zou het scherm dat je meet
 * vervangen door een ander.
 *
 * `Link` moet wél DOM opleveren, want hij zit ín de layout: `asChild` geeft zijn kind terug
 * (dat is de vorm die de auth-schermen gebruiken), anders wikkelt hij in een Text-loze
 * fragment-vervanger. Zou `Link` `null` teruggeven, dan verdween er layout en meet de
 * bouwspec een scherm dat de app niet toont.
 *
 * `useLocalSearchParams` levert de waarden uit `parameters.routeParams` van de story, zodat
 * `history/[id]` een id ziet zonder dat de mock er een verzint.
 */

/** De story-parameters die deze mock leest. Gezet via `parameters.routeParams` in de story. */
let huidigeParams: Record<string, string> = {};

/** Door de decorator gezet, vóór de story rendert. */
export function __setRouteParams(p: Record<string, string>) {
  huidigeParams = p ?? {};
}

const meld = (wat: string) => (...args: unknown[]) => {
  // Niet stil: een story die navigeert doet in Storybook niets, en dat hoort zichtbaar te zijn.
  console.info(`[expo-router mock] ${wat}`, ...args);
};

export const router = {
  push: meld('push'),
  replace: meld('replace'),
  back: meld('back'),
  navigate: meld('navigate'),
  dismiss: meld('dismiss'),
  dismissAll: meld('dismissAll'),
  setParams: meld('setParams'),
  canGoBack: () => false,
};

export const useRouter = () => router;
export const usePathname = () => '/';
export const useSegments = () => [] as string[];
export const useLocalSearchParams = <T extends Record<string, string>>() => huidigeParams as T;
export const useGlobalSearchParams = useLocalSearchParams;
/**
 * In een story is het scherm ALTIJD gefocust, dus draait de callback één keer als een gewone
 * `useEffect`. Als no-op was hij fout op precies de manier die deze mocks moeten voorkomen:
 * `profile` haalt zijn gegevens in een `useFocusEffect` op, en met een lege mock bleef dat
 * scherm stil in zijn loading-tak staan — 7 nodes, geen tekst, en géén foutmelding
 * (gemeten 2026-09-09).
 */
export const useFocusEffect = (fn: () => void | (() => void)) => {
  useEffect(() => fn(), [fn]);
};

/**
 * `asChild` geeft het kind ongewijzigd terug — precies wat de auth-schermen doen
 * (`<Link asChild><TouchableOpacity>…</TouchableOpacity></Link>`). Zonder asChild geven we de
 * kinderen kaal terug: een extra wrapper zou een node toevoegen die de app niet heeft, en dat
 * is precies wat `spec-diff` als verschil zou melden.
 */
export function Link({ children, asChild }: { href?: string; asChild?: boolean; children?: ReactNode }) {
  if (asChild && isValidElement(children)) return cloneElement(children);
  return <>{Children.toArray(children)}</>;
}

/** De navigator zelf rendert in een story niets: hij bestaat om routes te declareren. */
export function Stack(_: unknown) { return null; }
Stack.Screen = function Screen(_: unknown) { return null; };

export const Redirect = () => null;
export const Slot = ({ children }: { children?: ReactNode }) => <>{children}</>;
