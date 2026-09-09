import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { TOESTEL } from '../../.storybook/toestel';
import { IdlePhase } from './IdlePhase';
import type { FoundDevice } from '@/lib/ble/types';

/**
 * De argTypes met `options` zijn de variant-assen: `bleStatus` en `hrStatus` (de twee
 * toestelrijen), `idleGoalType` (welk doelblok onder de segments verschijnt) en `picking`
 * (welk toesteltype de keuze-sheet toont). Booleans heeft dit component niet.
 *
 * Twee van die assen zijn nullable in het type: `idleGoalType: null` is het "Geen"-segment
 * (vrij trainen) en `picking: null` betekent dat de sheet dicht is. De `options` bevatten
 * alleen de echte literals — de null-kant staat als aparte story hieronder.
 *
 * De picker-index, de chips en het "actief"-vinkje zijn interne state van het component; de
 * suggestie-chips komen uit `useRecentGoals`. Zonder ingelogde gebruiker levert die hook een
 * lege lijst en vult het component de drie chips met zijn defaults — dat is de lege toestand
 * en wat de stories tonen.
 *
 * `insets` staat op nul: Storybook heeft geen notch, en een safe-area-waarde is een
 * toestelmaat, geen designtoken.
 */
const roeitrainers: FoundDevice[] = [
  { id: 'pm5-4821', name: 'Concept2 PM5 4821', rssi: -48 },
  { id: 's4-0118', name: 'WaterRower S4', rssi: -72 },
];

const hartslagbanden: FoundDevice[] = [
  { id: 'polar-h10', name: 'Polar H10 8A2F41', rssi: -52 },
  { id: 'hrm-pro', name: 'Garmin HRM-Pro 3117', rssi: -77 },
];

const geenInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const meta = {
  title: 'Componenten/IdlePhase',
  component: IdlePhase,
  argTypes: {
    bleStatus: {
      control: 'select',
      options: [
        'idle',
        'scanning',
        'connecting',
        'discovering',
        'connected',
        'disconnecting',
        'reconnecting',
        'error',
      ],
    },
    hrStatus: { control: 'select', options: ['idle', 'scanning', 'waiting', 'connected', 'error'] },
    idleGoalType: { control: 'select', options: ['duration', 'distance', 'split', 'watts'] },
    picking: { control: 'select', options: ['rower', 'hr'] },
    devices: { control: 'object' },
    insets: { control: 'object' },
    onConnect: { control: false },
    onDisconnect: { control: false },
    onHRConnect: { control: false },
    onHRDisconnect: { control: false },
    onSelectDevice: { control: false },
    onCancelSelection: { control: false },
    setIdleGoalType: { control: false },
    setIdleGoalInput: { control: false },
    setIdleDurMin: { control: false },
    setIdleDurSec: { control: false },
    onStart: { control: false },
  },
  args: {
    bleStatus: 'connected',
    deviceName: 'Concept2 PM5 4821',
    onConnect: () => {},
    onDisconnect: () => {},
    hrStatus: 'connected',
    hrDeviceName: 'Polar H10 8A2F41',
    hrError: null,
    onHRConnect: () => {},
    onHRDisconnect: () => {},
    devices: roeitrainers,
    picking: null,
    onSelectDevice: () => {},
    onCancelSelection: () => {},
    idleGoalType: 'duration',
    setIdleGoalType: () => {},
    setIdleGoalInput: () => {},
    setIdleDurMin: () => {},
    setIdleDurSec: () => {},
    onStart: () => {},
    insets: geenInsets,
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2020-13918' },
    // Zie ActivePhase: een scherm rendert full-bleed op toestelmaat. Hier telt het extra —
    // de full-bleed-truc in GoalHeader rekent met `useWindowDimensions()`, dus in een
    // decorator van 303 px liep dat element 127 px buiten zijn container.
    toestel: TOESTEL.portret,
  },
} satisfies Meta<typeof IdlePhase>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle args in meta. */
export const Playground: Story = {};

/** De null-kant van `idleGoalType`: het "Geen"-segment, met de vrij-trainen-regel in plaats van een picker. */
export const ZonderDoel: Story = {
  args: { idleGoalType: null },
};

/** Afstandsdoel: chips op 2, 5 en 10 km, wielpicker in meters. */
export const DoelAfstand: Story = {
  args: { idleGoalType: 'distance' },
};

/** Splitdoel: chips op 2:00, 2:10 en 2:20 per 500 m. */
export const DoelSplit: Story = {
  args: { idleGoalType: 'split' },
};

/** Vermogensdoel: chips op 150, 180 en 200 W. */
export const DoelVermogen: Story = {
  args: { idleGoalType: 'watts' },
};

/** Vertreksituatie: geen trainer, geen band — beide rijen tonen "Verbinden". */
export const NietVerbonden: Story = {
  args: {
    bleStatus: 'idle',
    deviceName: null,
    hrStatus: 'idle',
    hrDeviceName: null,
  },
};

/** Loading: de trainerrij draait en de actie is uitgeschakeld zolang de scan loopt. */
export const Verbinden: Story = {
  args: { bleStatus: 'scanning', deviceName: null },
};

/** Fout: de trainerrij kleurt rood en biedt "Opnieuw" aan. */
export const Fout: Story = {
  args: { bleStatus: 'error', deviceName: null },
};

/**
 * Hartslagfout: de rij valt terug op "Verbinden", met de reden eronder. Zonder die regel is
 * een mislukte scan niet te onderscheiden van een dode knop.
 */
export const HartslagFout: Story = {
  args: {
    hrStatus: 'error',
    hrDeviceName: null,
    hrError: 'Geen hartslagmeter gevonden — zet de band om en probeer opnieuw',
  },
};

/**
 * Tussenstand van de band: verbonden, maar er is nog geen hartslag binnengekomen.
 * Bewust niet groen — dat zou "het werkt" beweren.
 */
export const HartslagWacht: Story = {
  args: { hrStatus: 'waiting' },
};

/** Twee trainers in de zaal: de keuze-sheet schuift over het scherm. */
export const ToestelKeuze: Story = {
  args: { picking: 'rower', bleStatus: 'scanning', deviceName: null },
};

/** Dezelfde sheet voor de hartslagband, met hart-icoon en eigen titel. */
export const HartslagKeuze: Story = {
  args: {
    picking: 'hr',
    devices: hartslagbanden,
    hrStatus: 'scanning',
    hrDeviceName: null,
  },
};
