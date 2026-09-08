/**
 * Storybook-mock voor `@/lib/supabase`.
 *
 * WAAROM DIT BESTAAT. `lib/supabase.ts` gooit bij module-load zodra
 * EXPO_PUBLIC_SUPABASE_URL/ANON_KEY ontbreken — dezelfde valkuil die
 * apps/rowtrack/CLAUDE.md → Verify-pad al beschrijft voor een verse tree. Gemeten op
 * 2026-09-07: zonder deze mock gooide de smoke-story en rendeerde géén van de 34
 * componenten, met één console-fout als enige signaal.
 *
 * WAAROM GEEN ECHTE SLEUTELS. Een Storybook met werkende credentials zou bij elke
 * story de productiedatabase aanspreken. De componentlaag hoort zonder backend te
 * tonen wat ze toont; data komt via props of via een expliciete hook-mock.
 *
 * Het stub-antwoord is `{ data: null, error: null }`: hooks vallen daardoor in hun
 * lege toestand in plaats van in hun fouttoestand. Wie een gevulde of foute toestand
 * wil tonen, doet dat met een story-arg — niet door deze mock te verbouwen.
 */
type Antwoord = { data: null; error: null };
const antwoord: Antwoord = { data: null, error: null };

const keten: any = new Proxy(
  {
    // Een keten-object is tegelijk thenable, zodat `await supabase.from(..).select(..)`
    // eindigt op het stub-antwoord ongeacht hoeveel schakels ertussen zitten.
    then: (resolve: (a: Antwoord) => void) => resolve(antwoord),
  },
  { get: (doel: any, prop) => (prop in doel ? doel[prop] : () => keten) },
);

export const AUTH_STORAGE_KEY = 'sb-storybook-auth-token';

export const supabase: any = {
  from: () => keten,
  rpc: () => keten,
  channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}), unsubscribe: () => {} }),
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
  },
};
