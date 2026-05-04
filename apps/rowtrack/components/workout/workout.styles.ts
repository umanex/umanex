import { StyleSheet } from 'react-native';
import {
  background,
  brand,
  status as statusColors,
  text as textColors,
  border,
  overlay,
  fontFamily,
  fontSize,
  letterSpacing,
  space,
  layout,
  componentRadius,
  radii,
} from '@/constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: background.base,
    paddingHorizontal: layout.screenHorizontal,
  },

  // Idle
  idleContent: {
    flex: 1,
    gap: space[6],
  },
  idleTitle: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: fontSize['28'],
    color: textColors.primary,
    paddingTop: space[6],
  },
  idleStartWrap: {
    paddingBottom: space[4],
  },
  goalSegmented: {
    flexDirection: 'row',
    backgroundColor: background.surface,
    borderRadius: radii.md,
    padding: space.px,
  },
  goalSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[2],
    borderRadius: radii.sm,
  },
  goalSegmentActive: {
    backgroundColor: brand.primary,
  },
  goalSegmentText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['11'],
    color: textColors.muted,
  },
  goalSegmentTextActive: {
    color: background.base,
  },
  goalInputSection: {
    gap: space[3],
  },
  durationRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  durationInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  goalInput: {
    flex: 1,
    backgroundColor: background.surface,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: componentRadius.input,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    fontFamily: fontFamily.monoMedium,
    fontSize: fontSize['36'],
    color: textColors.primary,
    textAlign: 'center',
  },
  goalUnitLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['16'],
    color: textColors.secondary,
  },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: background.surface,
    borderRadius: radii.full,
  },
  chipActive: {
    backgroundColor: brand.primary,
  },
  chipText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['12'],
    color: textColors.muted,
  },
  chipTextActive: {
    color: background.base,
  },
  // Active — Timer
  timerContainer: {
    alignItems: 'center',
    paddingTop: space[8],
    paddingBottom: space[6],
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  timerLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['10'],
    color: textColors.muted,
    letterSpacing: 0.5,
    marginBottom: space[1],
  },
  timer: {
    fontFamily: fontFamily.monoMedium,
    fontSize: fontSize['60'],
    lineHeight: fontSize['60'] * 1.1,
    color: brand.primary,
    letterSpacing: letterSpacing.wider * fontSize['60'],
  },

  // Mini timer (when focus hero takes over)
  miniTimerContainer: {
    alignItems: 'center',
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  miniTimerLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['10'],
    color: textColors.muted,
    letterSpacing: 0.5,
  },
  miniTimer: {
    fontFamily: fontFamily.monoMedium,
    fontSize: fontSize['24'],
    lineHeight: fontSize['24'] * 1.1,
    color: textColors.secondary,
    letterSpacing: letterSpacing.wider * fontSize['24'],
  },

  // Connected badge
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: background.elevated,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.full,
    marginBottom: space[1],
  },
  connectedText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['12'],
    color: brand.primary,
  },

  // Connection overlay
  connectionOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[4],
  },
  connectionText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize['16'],
    color: textColors.secondary,
    textAlign: 'center',
  },

  // Active scroll
  activeScroll: {
    flex: 1,
  },
  activeScrollContent: {
    gap: space[4],
    paddingBottom: space[4],
  },

  // Focus hero
  focusHero: {
    alignItems: 'center',
    gap: space[1],
  },
  focusValue: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: fontSize['48'],
    lineHeight: fontSize['48'] * 1.1,
  },
  focusLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['12'],
    color: textColors.muted,
    letterSpacing: 0.5,
  },

  // Pace zone
  paceZoneContainer: {
    alignItems: 'center',
  },

  // Active — Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // PR badge
  prBadge: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['10'],
    color: statusColors.warning,
    marginTop: space[1],
  },

  // Active — Stop
  stopContainer: {
    paddingVertical: space[6],
  },

  // Modal
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
    backgroundColor: background.elevated,
    borderRadius: componentRadius.modal,
    padding: space[6],
    gap: space[5],
  },
  modalTitle: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: fontSize['24'],
    color: textColors.primary,
    textAlign: 'center',
  },
  summaryGrid: {
    gap: space[3],
  },

  // PR banner
  prBanner: {
    backgroundColor: statusColors.warning,
    borderRadius: radii.md,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    alignItems: 'center',
  },
  prBannerText: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['16'],
    color: background.base,
  },

  // Summary splits
  summarySplits: {
    gap: space[2],
  },
  summarySplitsTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['10'],
    color: textColors.muted,
    letterSpacing: 0.5,
  },
});
