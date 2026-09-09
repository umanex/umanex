import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ConnectionStatus } from '@/lib/ble/types';
import { Button } from '@/components/Button';
import { t } from '@/i18n';
import { accent, fg, fontFamily, fontSize, space, typeStyles } from '@/constants';

export type ConnectionOverlayProps = {
  /**
   * Elke status BEHALVE `connected` — bij verbinding bestaat deze overlay niet en rendert
   * ActivePhase zijn layout. Een `connected`-geval zou hier een scherm tonen dat de app nooit
   * laat zien.
   */
  bleStatus: Exclude<ConnectionStatus, 'connected'>;
  /** De BLE-foutmelding; alleen zichtbaar bij `bleStatus === 'error'`. */
  bleError: string | null;
  onRetry: () => void;
  onStop: () => void;
  /** Verstreken tijd, al geformatteerd — de overlay rekent niet. */
  elapsed: string;
  paddingHorizontal: number;
};

/**
 * Het volledige scherm zolang de trainer niet verbonden is: spinner met statuszin, of bij een
 * fout een waarschuwingsicoon met de melding en Opnieuw.
 *
 * De Stop-knop onderaan staat er ALTIJD, ook tijdens een reconnect. Deze overlay verbergt de
 * header met zijn eigen Stop en de tabbar is in een training al weg — zonder deze knop zit de
 * roeier vast (audit P0-F2).
 */
export function ConnectionOverlay({ bleStatus, bleError, onRetry, onStop, elapsed, paddingHorizontal }: ConnectionOverlayProps) {
  return (
    <View testID="ConnectionOverlay" style={[styles.connectionOverlay, { paddingHorizontal }]}>
      {bleStatus !== 'error' ? (
        <>
          <ActivityIndicator color={accent.default} size="large" />
          <Text style={styles.connectionText}>
            {(bleStatus === 'idle' || bleStatus === 'scanning') && t.workout.connection.searching}
            {bleStatus === 'connecting' && t.workout.connection.connecting}
            {bleStatus === 'discovering' && t.workout.connection.discovering}
            {bleStatus === 'reconnecting' && t.workout.connection.reconnecting}
            {bleStatus === 'disconnecting' && t.workout.connection.disconnecting}
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="warning-outline" size={40} color={fg.secondary} />
          <Text style={styles.connectionText}>{bleError}</Text>
          <Button title={t.common.retry} onPress={onRetry} size="md" variant="ghost" />
        </>
      )}
      <Text style={styles.connectionElapsed}>{t.workout.connection.elapsed(elapsed)}</Text>
      <Button title={t.workout.connection.stopButton} onPress={onStop} size="md" />
    </View>
  );
}

const styles = StyleSheet.create({
  connectionOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space['16'],
  },
  connectionText: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['16'],
    color: fg.secondary,
    textAlign: 'center',
  },
  connectionElapsed: {
    ...typeStyles.italicConnector,
    color: fg.secondary,
  },
});
