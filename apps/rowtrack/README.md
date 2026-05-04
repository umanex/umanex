# RowTrack

Rowing workout tracker voor iOS en Android. Verbindt live met een Fluid Rower Apollo XL via Bluetooth (FTMS protocol).

## Tech Stack

- **Expo** (React Native) met TypeScript
- **NativeWind** (Tailwind CSS voor mobile)
- **react-native-ble-plx** voor Bluetooth / FTMS
- **Supabase** voor database en authenticatie

## Aan de slag

```bash
npm install
npx expo start
```

Maak een `.env` bestand aan:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database

Voer `supabase/schema.sql` uit in de Supabase SQL Editor om de tabellen aan te maken.

## Design Tokens

De `tokens/` map bevat design tokens in Tokens Studio formaat voor bidirectionele sync met Figma. De bronwaarden staan in `constants/`.

## Mapstructuur

```
app/          — Schermen en navigatie (Expo Router)
components/   — Herbruikbare UI componenten
constants/    — Design tokens (kleuren, typografie, spacing)
lib/          — Supabase client, auth, services
tokens/       — Tokens Studio JSON voor Figma sync
supabase/     — Database schema
```
