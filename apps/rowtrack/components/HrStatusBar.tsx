import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HRStatus } from '@/lib/ble/types';
import { background, brand, status as statusColors, text as textColors, fontFamily, fontSize } from '@/constants';

interface HrStatusBarProps {
  hrStatus: HRStatus;
  hrDeviceName: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function HrStatusBar({ hrStatus, hrDeviceName, onConnect, onDisconnect }: HrStatusBarProps) {
  const isScanning = hrStatus === 'scanning';
  const isConnected = hrStatus === 'connected';

  let heartColor: string = textColors.muted;
  let label = 'Hartslagmeter';

  if (isScanning) {
    heartColor = brand.primary;
    label = 'Zoeken...';
  } else if (isConnected) {
    heartColor = statusColors.success;
    label = hrDeviceName || 'HR verbonden';
  }

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {isScanning ? (
          <ActivityIndicator size="small" color={brand.primary} />
        ) : (
          <Ionicons name="heart" size={14} color={heartColor} />
        )}
        <Text style={styles.label}>{label}</Text>
      </View>

      {!isScanning && !isConnected && (
        <TouchableOpacity style={styles.connectBtn} onPress={onConnect} activeOpacity={0.8}>
          <Text style={styles.connectBtnText}>Verbind</Text>
        </TouchableOpacity>
      )}

      {isConnected && (
        <TouchableOpacity style={styles.disconnectBtn} onPress={onDisconnect} activeOpacity={0.8}>
          <Text style={styles.disconnectBtnText}>Verbreek</Text>
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
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
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
