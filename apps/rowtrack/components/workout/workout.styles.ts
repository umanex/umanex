import { StyleSheet } from 'react-native';
import {
  bg,
  fg,
  overlay,
  fontFamily,
  fontSize,
  space,
  layout,
  componentRadius,
  typeStyles,
} from '@/constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bg.base,
    paddingHorizontal: layout.screenHorizontal,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: overlay.scrim,
    justifyContent: 'center',
    paddingHorizontal: layout.screenHorizontal,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: bg.elevated,
    borderRadius: componentRadius.modal,
    padding: space['20'],
    gap: space['20'],
  },
  modalTitle: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: fontSize['24'],
    color: fg.primary,
    textAlign: 'center',
  },
});
