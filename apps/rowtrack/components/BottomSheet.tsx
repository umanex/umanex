import { memo, useEffect, useRef, type ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  type KeyboardEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import {
  bg,
  fg,
  overlay,
  typeStyles,
  space,
  componentRadius,
} from '@/constants';

export type BottomSheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Vaste actie onderaan (buiten de scroll) — blijft altijd zichtbaar, ook bij hoge content zoals een wheel. */
  footer?: ReactNode;
  /**
   * De componentgrens in de DOM (`data-testid` via react-native-web). Een component dat deze
   * sheet als zijn eigen wortel rendert — GoalSheet — geeft hier zijn eigen naam mee, anders
   * staat zijn grens nergens. Zie scripts/figma-build-spec.mjs.
   */
  testID?: string;
};

const ANIM_MS = 220;

export const BottomSheet = memo(function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  testID = 'BottomSheet',
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  // useSafeAreaInsets() geeft binnen een RN <Modal> vaak bottom: 0 terug (de SafeAreaProvider-
  // context kruist de Modal-grens niet). Fallback op de statische window-metrics.
  const safeBottom = insets.bottom || initialWindowMetrics?.insets?.bottom || 0;

  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  // Keyboard-lift: hoeveel de sheet omhoog moet zodat de content boven het toetsenbord staat.
  const kbOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 1,
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: ANIM_MS,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slide.setValue(0);
      fade.setValue(0);
      kbOffset.setValue(0);
    }
  }, [visible, slide, fade, kbOffset]);

  // Til de sheet boven het toetsenbord. De safeBottom valt weg tegen de sheet-paddingBottom,
  // zodat de knop netjes ~space['20'] boven het toetsenbord staat (en boven de home-indicator
  // wanneer het toetsenbord dicht is). De bg-extensie onderaan dekt de vrijgekomen gap.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => {
      Animated.timing(kbOffset, {
        toValue: Math.max(0, (e.endCoordinates?.height ?? 0) - safeBottom),
        duration: e.duration || ANIM_MS,
        useNativeDriver: true,
      }).start();
    };
    const onHide = (e: KeyboardEvent) => {
      Animated.timing(kbOffset, {
        toValue: 0,
        duration: e?.duration || ANIM_MS,
        useNativeDriver: true,
      }).start();
    };
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [kbOffset, safeBottom]);

  function handleClose() {
    Keyboard.dismiss();
    onClose();
  }

  const translateY = Animated.subtract(
    slide.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }),
    kbOffset,
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View testID={testID} dataSet={{ bron: 'BottomSheet' }} style={styles.root}>
        <Animated.View style={[styles.scrim, { opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: space['20'] + safeBottom,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Verlengt de sheet-achtergrond onder de onderrand, zodat er bij een keyboard-lift
              geen scrim-gap onderaan ontstaat. Off-screen wanneer de sheet in ruststand staat. */}
          <View style={styles.bottomExtension} pointerEvents="none" />

          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityLabel={t.common.close}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={fg.primary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: overlay.scrim,
  },
  sheet: {
    backgroundColor: bg.raised,
    borderTopLeftRadius: componentRadius.modal,
    borderTopRightRadius: componentRadius.modal,
    paddingHorizontal: space['32'],
    paddingTop: space['32'],
    maxHeight: '90%',
  },
  // Vult de ruimte onder de sheet-onderrand met de sheet-bg tijdens een keyboard-lift.
  bottomExtension: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    height: 800,
    backgroundColor: bg.raised,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    marginBottom: space['16'],
  },
  title: {
    flex: 1,
    ...typeStyles.sectionValue,
    color: fg.primary,
  },
  closeBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: {
    // flexShrink MOET 0 blijven: met flexShrink:1 "hugt" een RN ScrollView zijn content
    // niet in een maxHeight-container (Yoga-valkuil) en collapse't ~8px te kort → de body
    // wordt onderaan afgekapt (bv. de segmented-track). 0 = hug op exacte content-hoogte.
    // De sheet wordt boven het toetsenbord getild (kbOffset), dus de body hoeft niet te
    // krimpen voor het keyboard.
    flexGrow: 0,
    flexShrink: 0,
  },
  bodyContent: {
    gap: space['16'],
    paddingBottom: space['8'],
  },
  footer: {
    marginTop: space['16'],
  },
});
