import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import type { ConnectionStatus } from '@/lib/ble/types';
import { background, brand, status as statusColors, text as textColors, fontFamily, fontSize } from '@/constants';

interface BleStatusBarProps {
  bleStatus: ConnectionStatus;
  deviceName: string | null;
  bleError: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function BleStatusBar({ bleStatus, deviceName, bleError, onConnect, onDisconnect }: BleStatusBarProps) {
  const isConnecting = bleStatus === 'scanning' || bleStatus === 'connecting' || bleStatus === 'discovering';
  const isConnected = bleStatus === 'connected';
  const isError = bleStatus === 'error';

  let dotColor: string = textColors.muted;
  let label = 'Niet verbonden';

  if (isConnecting) {
    dotColor = brand.primary;
    label = 'Verbinden...';
  } else if (isConnected) {
    dotColor = statusColors.success;
    label = deviceName || 'Verbonden';
  } else if (isError) {
    dotColor = statusColors.error;
    label = 'Verbinding mislukt';
  }

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {isConnecting ? (
          <ActivityIndicator size="small" color={brand.primary} />
        ) : (
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        )}
        <Text style={styles.label}>{label}</Text>
      </View>

      {!isConnecting && !isConnected && !isError && (
        <TouchableOpacity style={styles.connectBtn} onPress={onConnect} activeOpacity={0.8}>
          <Text style={styles.connectBtnText}>Verbind</Text>
        </TouchableOpacity>
      )}

      {isConnected && (
        <TouchableOpacity style={styles.disconnectBtn} onPress={onDisconnect} activeOpacity={0.8}>
          <Text style={styles.disconnectBtnText}>Verbreek</Text>
        </TouchableOpacity>
      )}

      {isError && (
        <TouchableOpacity style={styles.connectBtn} onPress={onConnect} activeOpacity={0.8}>
          <Text style={styles.connectBtnText}>Opnieuw</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: background.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['14'],
    color: textColors.primary,
  },
  connectBtn: {
    backgroundColor: brand.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  connectBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['13'],
    color: textColors.inverse,
  },
  disconnectBtn: {
    backgroundColor: statusColors.error,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  disconnectBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['13'],
    color: '#FFFFFF',
  },
});
