import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { signOut, deleteAccount, type DeleteAccountFailure } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/monitoring';
import { Button, WheelPicker, GoalSheet, Segmented, type SegmentedOption } from '@/components';
import { GoalProgressCard } from '@/components/GoalProgressCard';
import { BottomSheet } from '@/components/BottomSheet';
import { usePeriodGoal } from '@/lib/hooks/usePeriodGoal';
import { useHealthConsent } from '@/lib/health-consent-context';
import { t } from '@/i18n';
import {
  bg,
  fg,
  accent,
  border,
  space,
  typeStyles,
  fontFamily,
  fontSize,
  radii,
  componentRadius,
  body,
  status,
} from '@/constants';
import type { WheelItem } from '@/lib/formatters';

// --- Date of birth helpers ---

const BIRTH_YEAR_MIN = 1930;
const BIRTH_YEAR_MAX = new Date().getFullYear() - 5;
const BIRTH_YEARS = Array.from(
  { length: BIRTH_YEAR_MAX - BIRTH_YEAR_MIN + 1 },
  (_, i) => BIRTH_YEAR_MIN + i,
);

const GENDER_OPTIONS: SegmentedOption<string>[] = [
  { value: 'male', label: t.profile.genderMale },
  { value: 'female', label: t.profile.genderFemale },
  { value: 'other', label: t.profile.genderOther },
];

const DAY_ITEMS: WheelItem[] = Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: i + 1 }));
const MONTH_ITEMS: WheelItem[] = t.dates.monthsShort.map((m, i) => ({ label: m, value: i + 1 }));
const YEAR_ITEMS: WheelItem[] = BIRTH_YEARS.map(y => ({ label: String(y), value: y }));

// Lengte/gewicht: single-column wheels met de unit binnen de wheel (value + unit).
const HEIGHT_MIN = 100, HEIGHT_MAX = 250;
const WEIGHT_MIN = 30, WEIGHT_MAX = 300;
const HEIGHT_ITEMS: WheelItem[] = Array.from({ length: HEIGHT_MAX - HEIGHT_MIN + 1 }, (_, i) => {
  const v = HEIGHT_MIN + i;
  return { label: `${v} cm`, value: v, unit: 'cm' };
});
const WEIGHT_ITEMS: WheelItem[] = Array.from({ length: WEIGHT_MAX - WEIGHT_MIN + 1 }, (_, i) => {
  const v = WEIGHT_MIN + i;
  return { label: `${v} kg`, value: v, unit: 'kg' };
});

const DEFAULT_YEAR_IDX = Math.max(0, BIRTH_YEARS.indexOf(1990));

function parseBirthDate(date: string | null): { dayIdx: number; monthIdx: number; yearIdx: number } {
  if (!date) return { dayIdx: 0, monthIdx: 0, yearIdx: DEFAULT_YEAR_IDX };
  const [y, m, d] = date.split('-').map(Number);
  return {
    dayIdx: Math.max(0, d - 1),
    monthIdx: Math.max(0, m - 1),
    yearIdx: Math.max(0, BIRTH_YEARS.indexOf(y)),
  };
}

function indicesToDate(dayIdx: number, monthIdx: number, yearIdx: number): string {
  const d = String(dayIdx + 1).padStart(2, '0');
  const m = String(monthIdx + 1).padStart(2, '0');
  const y = BIRTH_YEARS[yearIdx];
  return `${y}-${m}-${d}`;
}

function formatBirthDate(date: string | null): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function genderLabel(g: string | null): string {
  if (g === 'male') return t.profile.genderMale;
  if (g === 'female') return t.profile.genderFemale;
  if (g === 'other') return t.profile.genderOther;
  return '—';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SheetType = 'none' | 'voornaam' | 'email' | 'geslacht' | 'lengte' | 'gewicht' | 'geboortedatum' | 'doel' | 'verwijderen';

const DELETE_ERROR_COPY: Record<DeleteAccountFailure, string> = {
  wrong_password: t.profile.deleteSheet.wrongPassword,
  not_signed_in: t.profile.deleteSheet.notSignedIn,
  unavailable: t.profile.deleteSheet.unavailable,
  rate_limited: t.profile.deleteSheet.rateLimited,
  uncertain: t.profile.deleteSheet.uncertain,
  failed: t.profile.deleteSheet.failed,
};

export default function ProfileScreen() {
  const { user, clearSession } = useAuth();
  const { granted: healthGranted, grant: grantHealth, revoke: revokeHealth } = useHealthConsent();
  const insets = useSafeAreaInsets();

  const { goalProgress, refetch: refetchGoal } = usePeriodGoal(user?.id);

  // --- Profile state ---
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [spmHalved, setSpmHalved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- Sheet state ---
  const [sheetOpen, setSheetOpen] = useState<SheetType>('none');

  // Voornaam draft
  const [draftName, setDraftName] = useState('');

  // Email draft
  const [draftEmail, setDraftEmail] = useState('');
  const [draftEmailRepeat, setDraftEmailRepeat] = useState('');
  const [draftPassword, setDraftPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailChanging, setEmailChanging] = useState(false);

  // Account verwijderen
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);

  // Body data drafts
  const [draftGender, setDraftGender] = useState<string | null>(null);
  const [draftHeight, setDraftHeight] = useState(170);
  const [draftWeight, setDraftWeight] = useState(70);
  const [draftDayIdx, setDraftDayIdx] = useState(0);
  const [draftMonthIdx, setDraftMonthIdx] = useState(0);
  const [draftYearIdx, setDraftYearIdx] = useState(DEFAULT_YEAR_IDX);

  // --- Input refs for autofocus and field chaining ---
  const nameInputRef = useRef<TextInput>(null);
  const newEmailRef = useRef<TextInput>(null);
  const repeatEmailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Autofocus after sheet open animation (ANIM_MS = 220ms → wait 250ms)
  useEffect(() => {
    if (sheetOpen === 'voornaam') {
      const t = setTimeout(() => nameInputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
    if (sheetOpen === 'email') {
      const t = setTimeout(() => newEmailRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [sheetOpen]);

  // --- Fetch profile ---
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name, gender, height_cm, weight_kg, birth_date, spm_halved')
      .eq('id', user.id)
      .single();

    setDisplayName(data?.display_name ?? '');
    setGender(data?.gender ?? null);
    setHeightCm(data?.height_cm ?? null);
    setWeightKg(data?.weight_kg ?? null);
    setBirthDate(data?.birth_date ?? null);
    setSpmHalved(data?.spm_halved ?? false);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );

  // --- Sheet openers ---
  function openVoornaam() {
    setDraftName(displayName);
    setSheetOpen('voornaam');
  }

  function openEmail() {
    setDraftEmail('');
    setDraftEmailRepeat('');
    setDraftPassword('');
    setEmailError(null);
    setSheetOpen('email');
  }

  function openGeslacht() {
    setDraftGender(gender);
    setSheetOpen('geslacht');
  }

  function openLengte() {
    setDraftHeight(heightCm ?? 170);
    setSheetOpen('lengte');
  }

  function openGewicht() {
    setDraftWeight(weightKg ?? 70);
    setSheetOpen('gewicht');
  }

  function openGeboortedatum() {
    const { dayIdx, monthIdx, yearIdx } = parseBirthDate(birthDate);
    setDraftDayIdx(dayIdx);
    setDraftMonthIdx(monthIdx);
    setDraftYearIdx(yearIdx);
    setSheetOpen('geboortedatum');
  }

  function openDoel() {
    setSheetOpen('doel');
  }

  function openVerwijderen() {
    setDeletePassword('');
    setDeleteError(null);
    setSheetOpen('verwijderen');
  }

  function closeSheet() {
    setSheetOpen('none');
  }

  // Tijdens het verwijderen mag de sheet niet dicht (X, scrim, Android-back):
  // halverwege wegklikken laat de gebruiker achter zonder te weten of zijn account
  // nu weg is. useCallback houdt de memo van BottomSheet intact.
  const closeDeleteSheet = useCallback(() => {
    if (deleting) return;
    setSheetOpen('none');
  }, [deleting]);

  // --- Sheet savers: persisteren direct naar Supabase (per veld, zoals GoalSheet).
  // Lokale state + sheet-sluiten pas ná een geslaagde write; bij een fout blijft de
  // sheet open zodat de gebruiker kan herproberen — de focus-refetch zou een enkel
  // lokaal gestagede waarde anders stil terugdraaien (UX-audit 2026-07-16, P0-F1).

  // Single-flight: één profiel-write tegelijk. De sheet-Buttons zijn al gegate via
  // loading, maar onSubmitEditing (Voornaam) en de Switch hebben geen eigen lock.
  const persistProfile = useCallback(async (patch: Record<string, unknown>): Promise<boolean> => {
    if (!user || saving) return false;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) {
        reportError(error, { where: 'profile.save' });
        Alert.alert(t.common.error, t.common.saveFailed(error.message));
        return false;
      }
      return true;
    } catch (e) {
      // postgrest-js resolvet fouten normaal als { error }; dit vangt enkel
      // transport-throws zodat `saving` nooit blijft hangen.
      reportError(e, { where: 'profile.save' });
      Alert.alert(t.common.error, t.common.saveFailedConnection);
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, saving]);

  // Sluit enkel de eigen sheet: resolvet een trage write nadat de gebruiker al een
  // ándere sheet opende, dan mag die niet dichtklappen.
  function closeOwnSheet(own: SheetType) {
    setSheetOpen(cur => (cur === own ? 'none' : cur));
  }

  async function saveVoornaam() {
    const name = draftName.trim();
    if (!(await persistProfile({ display_name: name || null }))) return;
    setDisplayName(name);
    closeOwnSheet('voornaam');
  }

  async function saveGeslacht() {
    if (!(await persistProfile({ gender: draftGender }))) return;
    setGender(draftGender);
    closeOwnSheet('geslacht');
  }

  async function saveLengte() {
    if (!(await persistProfile({ height_cm: draftHeight }))) return;
    setHeightCm(draftHeight);
    closeOwnSheet('lengte');
  }

  async function saveGewicht() {
    if (!(await persistProfile({ weight_kg: draftWeight }))) return;
    setWeightKg(draftWeight);
    closeOwnSheet('gewicht');
  }

  async function saveGeboortedatum() {
    const date = indicesToDate(draftDayIdx, draftMonthIdx, draftYearIdx);
    if (!(await persistProfile({ birth_date: date }))) return;
    setBirthDate(date);
    closeOwnSheet('geboortedatum');
  }

  // Switch heeft geen save-knop: optimistic togglen, terugrollen bij een gefaalde write.
  async function handleSpmToggle(value: boolean) {
    setSpmHalved(value);
    if (!(await persistProfile({ spm_halved: value }))) setSpmHalved(!value);
  }

  // --- Email change (direct Supabase auth write, not staged) ---
  const emailFormValid =
    EMAIL_RE.test(draftEmail) &&
    draftEmail === draftEmailRepeat &&
    draftPassword.length > 0;

  async function handleEmailChange() {
    if (!emailFormValid || !user?.email) return;
    setEmailError(null);
    setEmailChanging(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: draftPassword,
    });

    if (signInError) {
      setEmailError(t.profile.emailSheet.wrongPassword);
      setEmailChanging(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ email: draftEmail });
    setEmailChanging(false);

    if (updateError) {
      setEmailError(updateError.message);
      return;
    }

    setSheetOpen('none');
    Alert.alert(
      t.profile.emailSheet.confirmationSentTitle,
      t.profile.emailSheet.confirmationSentBody(draftEmail),
    );
  }

  async function handleDeleteAccount() {
    // Dubbeltap-slot: de knop is al disabled, maar onSubmitEditing op het
    // wachtwoordveld heeft die gate niet.
    if (deleting || !deletePassword) return;
    setDeleteError(null);
    setDeleting(true);

    try {
      const result = await deleteAccount(deletePassword);

      if (!result.ok) {
        setDeleteError(DELETE_ERROR_COPY[result.reason]);
        setDeleting(false);
        return;
      }

      // Het account is weg. Lukte de logout-call niet, dan is de sessie al uit de
      // opslag gehaald maar kwam er geen SIGNED_OUT-event — dan moeten we de
      // app-state zelf leegmaken, anders blijft de gate op een dode sessie staan
      // en houdt de sheet een spinner vast die niet weg kan.
      if (!result.signedOut) clearSession();

      // Het wachtwoord meteen uit het geheugen/scherm, en `deleting` bewust áán
      // laten staan: de auth-gate vervangt deze boom binnen een tick, en de sheet
      // sluiten zou eerst het profiel van een niet-bestaand account laten flitsen.
      setDeletePassword('');
    } catch (e) {
      // Bv. een keychain-fout in de storage-adapter: die propageert door
      // getSession() heen. Zonder catch blijft de sheet vergrendeld achter.
      reportError(e, { where: 'profile.deleteAccount' });
      setDeleteError(DELETE_ERROR_COPY.failed);
      setDeleting(false);
    }
  }

  // Aanzetten mag meteen; uitzetten wist gegevens en vraagt dus een bevestiging.
  async function handleHealthToggle(value: boolean) {
    if (healthBusy) return;
    if (value) {
      setHealthBusy(true);
      const ok = await grantHealth();
      setHealthBusy(false);
      if (!ok) Alert.alert(t.common.error, t.consent.saveFailed);
      return;
    }
    Alert.alert(t.consent.revokeTitle, t.consent.revokeBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.consent.revokeConfirm,
        style: 'destructive',
        onPress: async () => {
          setHealthBusy(true);
          const ok = await revokeHealth();
          setHealthBusy(false);
          if (!ok) {
            Alert.alert(t.common.error, t.consent.revokeFailed);
            return;
          }
          // De server heeft de velden gewist; de lokale kopie moet mee.
          setGender(null);
          setBirthDate(null);
          setHeightCm(null);
          setWeightKg(null);
        },
      },
    ]);
  }

  function handleLogout() {
    Alert.alert(t.profile.logout, t.profile.logoutConfirmBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.profile.logout, style: 'destructive', onPress: signOut },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={accent.default} />
      </View>
    );
  }

  const nameLabel = displayName || '—';
  const heightLabel = heightCm != null ? `${heightCm} cm` : '—';
  const weightLabel = weightKg != null ? `${weightKg} kg` : '—';

  return (
    <>
      <ScrollView
        testID="ProfileScreen"
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t.profile.title}</Text>

        {/* Doel */}
        <View style={styles.section}>
          {goalProgress ? (
            <View style={styles.goalCardBleed}>
              <GoalProgressCard progress={goalProgress} onEdit={openDoel} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.listRow}
              onPress={openDoel}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.listLabel}>{t.profile.noGoal}</Text>
              <Ionicons name="arrow-forward" size={16} color={fg.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ACCOUNT */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.profile.sectionAccount}</Text>
          <View style={styles.listCard}>
            <TouchableOpacity
              style={styles.listRow}
              onPress={openVoornaam}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.listLabel}>{t.profile.firstName}</Text>
              <View style={styles.listRight}>
                <Text style={styles.listValue}>{nameLabel}</Text>
                <Ionicons name="arrow-forward" size={16} color={fg.tertiary} />
              </View>
            </TouchableOpacity>
            <View style={styles.listDivider} />
            <TouchableOpacity
              style={styles.listRow}
              onPress={openEmail}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.listLabel}>{t.profile.email}</Text>
              <View style={styles.listRight}>
                <Text style={styles.listValue}>{user?.email ?? '—'}</Text>
                <Ionicons name="arrow-forward" size={16} color={fg.tertiary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* LICHAAMSGEGEVENS — enkel met toestemming; zonder die grondslag hoort de
            app deze velden niet eens aan te bieden. */}
        {healthGranted ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.profile.sectionBody}</Text>
          <View style={styles.listCard}>
            <TouchableOpacity
              style={styles.listRow}
              onPress={openGeslacht}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.listLabel}>{t.profile.gender}</Text>
              <View style={styles.listRight}>
                <Text style={styles.listValue}>{genderLabel(gender)}</Text>
                <Ionicons name="arrow-forward" size={16} color={fg.tertiary} />
              </View>
            </TouchableOpacity>
            <View style={styles.listDivider} />
            <TouchableOpacity
              style={styles.listRow}
              onPress={openGeboortedatum}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.listLabel}>{t.profile.birthDate}</Text>
              <View style={styles.listRight}>
                <Text style={styles.listValue}>{formatBirthDate(birthDate)}</Text>
                <Ionicons name="arrow-forward" size={16} color={fg.tertiary} />
              </View>
            </TouchableOpacity>
            <View style={styles.listDivider} />
            <TouchableOpacity
              style={styles.listRow}
              onPress={openLengte}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.listLabel}>{t.profile.height}</Text>
              <View style={styles.listRight}>
                <Text style={styles.listValue}>{heightLabel}</Text>
                <Ionicons name="arrow-forward" size={16} color={fg.tertiary} />
              </View>
            </TouchableOpacity>
            <View style={styles.listDivider} />
            <TouchableOpacity
              style={styles.listRow}
              onPress={openGewicht}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.listLabel}>{t.profile.weight}</Text>
              <View style={styles.listRight}>
                <Text style={styles.listValue}>{weightLabel}</Text>
                <Ionicons name="arrow-forward" size={16} color={fg.tertiary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
        ) : null}

        {/* GEZONDHEIDSGEGEVENS — de toestemming zelf, altijd zichtbaar en in beide
            richtingen te bedienen. Intrekken moet even makkelijk zijn als geven. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.consent.settingLabel}</Text>
          <View style={styles.listCard}>
            <View style={styles.listRow}>
              <View style={styles.spmToggleLabel}>
                <Text style={styles.listLabel}>{t.consent.settingLabel}</Text>
                <Text style={styles.listHint}>{t.consent.settingHint}</Text>
              </View>
              <Switch
                value={healthGranted}
                onValueChange={handleHealthToggle}
                disabled={healthBusy}
                trackColor={{ false: border.strong, true: accent.default }}
                thumbColor={fg.primary}
                ios_backgroundColor={border.strong}
              />
            </View>
          </View>
        </View>

        {/* ROEITRAINER */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.profile.sectionRower}</Text>
          <View style={styles.listCard}>
            <View style={styles.listRow}>
              <View style={styles.spmToggleLabel}>
                <Text style={styles.listLabel}>{t.profile.spmHalved}</Text>
                <Text style={styles.listHint}>{t.profile.spmHalvedHint}</Text>
              </View>
              <Switch
                value={spmHalved}
                onValueChange={handleSpmToggle}
                disabled={saving}
                trackColor={{ false: border.strong, true: accent.default }}
                thumbColor={fg.primary}
                ios_backgroundColor={border.strong}
              />
            </View>
          </View>
        </View>

        <Button title={t.profile.logout} onPress={handleLogout} variant="primary" size="lg" icon="arrow-forward" iconPosition="trailing" />

        {/* Account verwijderen — AVG art. 17 + Apple 5.1.1(v). Label in de gewone
            rij-stijl (fg.tertiary haalt AA, status.error op bg.raised niet); het
            rode icoon draagt het destructieve signaal en is non-text, dus 3:1. */}
        <View style={styles.section}>
          <View style={styles.listCard}>
            <TouchableOpacity
              style={styles.listRow}
              onPress={openVerwijderen}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t.profile.deleteAccount}
            >
              <Text style={styles.listLabel}>{t.profile.deleteAccount}</Text>
              <Ionicons name="trash-outline" size={18} color={status.error} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.version}>RowTrack v1.0.0</Text>
      </ScrollView>

      {/* Voornaam */}
      <BottomSheet
        visible={sheetOpen === 'voornaam'}
        onClose={closeSheet}
        title={t.profile.firstName}
        footer={<Button title={t.common.save} onPress={saveVoornaam} loading={saving} size="md" />}
      >
        <TextInput
          ref={nameInputRef}
          style={styles.sheetInput}
          value={draftName}
          onChangeText={setDraftName}
          placeholder={t.profile.firstNamePlaceholder}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!saving}
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={saveVoornaam}
          placeholderTextColor={fg.tertiary}
        />
      </BottomSheet>

      {/* E-mail wijzigen */}
      <BottomSheet
        visible={sheetOpen === 'email'}
        onClose={closeSheet}
        title={t.profile.emailSheet.title}
        footer={
          <Button
            title={t.profile.emailSheet.title}
            onPress={handleEmailChange}
            disabled={!emailFormValid || emailChanging}
            loading={emailChanging}
            size="md"
          />
        }
      >
        <View style={styles.sheetFieldGroup}>
          <Text style={styles.sheetFieldLabel}>{t.profile.emailSheet.currentEmail}</Text>
          <Text style={styles.currentEmailText}>{user?.email ?? ''}</Text>
        </View>

        <View style={styles.sheetFieldGroup}>
          <Text style={styles.sheetFieldLabel}>{t.profile.emailSheet.newEmail}</Text>
          <TextInput
            ref={newEmailRef}
            style={styles.sheetInput}
            value={draftEmail}
            onChangeText={text => { setDraftEmail(text); setEmailError(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => repeatEmailRef.current?.focus()}
            placeholder={t.profile.emailSheet.emailPlaceholder}
            placeholderTextColor={fg.tertiary}
          />
        </View>

        <View style={styles.sheetFieldGroup}>
          <Text style={styles.sheetFieldLabel}>{t.profile.emailSheet.repeatEmail}</Text>
          <TextInput
            ref={repeatEmailRef}
            style={styles.sheetInput}
            value={draftEmailRepeat}
            onChangeText={text => { setDraftEmailRepeat(text); setEmailError(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder={t.profile.emailSheet.emailPlaceholder}
            placeholderTextColor={fg.tertiary}
          />
        </View>

        <View style={styles.sheetFieldGroup}>
          <Text style={styles.sheetFieldLabel}>{t.profile.emailSheet.password}</Text>
          <TextInput
            ref={passwordRef}
            style={styles.sheetInput}
            value={draftPassword}
            onChangeText={text => { setDraftPassword(text); setEmailError(null); }}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={emailFormValid ? handleEmailChange : undefined}
            placeholder={t.profile.emailSheet.passwordPlaceholder}
            placeholderTextColor={fg.tertiary}
          />
        </View>

        {emailError && <Text style={styles.emailError}>{emailError}</Text>}
      </BottomSheet>

      {/* Geslacht */}
      <BottomSheet
        visible={sheetOpen === 'geslacht'}
        onClose={closeSheet}
        title={t.profile.gender}
        footer={<Button title={t.common.save} onPress={saveGeslacht} loading={saving} size="md" />}
      >
        <Segmented options={GENDER_OPTIONS} value={draftGender} onChange={setDraftGender} />
      </BottomSheet>

      {/* Lengte */}
      <BottomSheet
        visible={sheetOpen === 'lengte'}
        onClose={closeSheet}
        title={t.profile.height}
        footer={<Button title={t.common.save} onPress={saveLengte} loading={saving} size="md" />}
      >
        <WheelPicker
          items={HEIGHT_ITEMS}
          selectedIndex={draftHeight - HEIGHT_MIN}
          onIndexChange={(idx) => setDraftHeight(HEIGHT_MIN + idx)}
          visibleRows={3}
          surface="raised"
        />
      </BottomSheet>

      {/* Gewicht */}
      <BottomSheet
        visible={sheetOpen === 'gewicht'}
        onClose={closeSheet}
        title={t.profile.weight}
        footer={<Button title={t.common.save} onPress={saveGewicht} loading={saving} size="md" />}
      >
        <WheelPicker
          items={WEIGHT_ITEMS}
          selectedIndex={draftWeight - WEIGHT_MIN}
          onIndexChange={(idx) => setDraftWeight(WEIGHT_MIN + idx)}
          visibleRows={3}
          surface="raised"
        />
      </BottomSheet>

      {/* Geboortedatum */}
      <BottomSheet
        visible={sheetOpen === 'geboortedatum'}
        onClose={closeSheet}
        title={t.profile.birthDate}
        footer={<Button title={t.common.save} onPress={saveGeboortedatum} loading={saving} size="md" />}
      >
        <View style={styles.datePickerRow}>
          <View style={styles.datePickerBand} pointerEvents="none" />
          <View style={styles.datePickerCol}>
            <WheelPicker items={DAY_ITEMS} selectedIndex={draftDayIdx} onIndexChange={setDraftDayIdx} visibleRows={3} showPill={false} surface="raised" />
          </View>
          <View style={styles.datePickerCol}>
            <WheelPicker items={MONTH_ITEMS} selectedIndex={draftMonthIdx} onIndexChange={setDraftMonthIdx} visibleRows={3} showPill={false} surface="raised" />
          </View>
          <View style={styles.datePickerCol}>
            <WheelPicker items={YEAR_ITEMS} selectedIndex={draftYearIdx} onIndexChange={setDraftYearIdx} visibleRows={3} showPill={false} surface="raised" />
          </View>
        </View>
      </BottomSheet>

      {/* Account verwijderen */}
      <BottomSheet
        visible={sheetOpen === 'verwijderen'}
        onClose={closeDeleteSheet}
        title={t.profile.deleteSheet.title}
        footer={
          <Button
            title={t.profile.deleteSheet.confirm}
            onPress={handleDeleteAccount}
            variant="destructive"
            disabled={!deletePassword || deleting}
            loading={deleting}
            size="md"
          />
        }
      >
        <Text style={styles.deleteWarning}>{t.profile.deleteSheet.warning}</Text>

        <View style={styles.sheetFieldGroup}>
          <Text style={styles.sheetFieldLabel}>{t.profile.deleteSheet.password}</Text>
          {/* Bewust geen autofocus: het toetsenbord zou de waarschuwing wegduwen
              vóór ze gelezen is. */}
          <TextInput
            style={styles.sheetInput}
            value={deletePassword}
            onChangeText={text => { setDeletePassword(text); setDeleteError(null); }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!deleting}
            returnKeyType="done"
            onSubmitEditing={handleDeleteAccount}
            placeholder={t.profile.deleteSheet.passwordPlaceholder}
            placeholderTextColor={fg.tertiary}
          />
        </View>

        {deleteError && <Text style={styles.emailError}>{deleteError}</Text>}
      </BottomSheet>

      {/* Doel bewerken — gedeelde, zelf-persisterende sheet (ook op home in-place). */}
      <GoalSheet
        visible={sheetOpen === 'doel'}
        currentGoal={goalProgress?.goal ?? null}
        userId={user?.id}
        onClose={closeSheet}
        onSaved={refetchGoal}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bg.base,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: space['20'],
    paddingBottom: space['40'],
    paddingTop: space['20'],
    gap: space['20'],
  },
  title: {
    ...typeStyles.sectionValue,
    color: fg.primary,
  },

  // Sections
  section: {
    gap: space['8'],
  },
  // Doel-kaart breekt uit de content-padding (20) → volledige schermbreedte (band).
  goalCardBleed: {
    marginHorizontal: -space['20'],
  },
  sectionLabel: {
    ...typeStyles.labelGoalPrefix,
    color: fg.secondary,
  },

  // List card (grouped rows)
  listCard: {
    backgroundColor: bg.raised,
    borderRadius: componentRadius.cardSm,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space['16'],
    paddingVertical: 14,
    minHeight: 48,
  },
  listDivider: {
    height: 1,
    backgroundColor: border.default,
  },
  listLabel: {
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
  },
  listRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
  },
  listValue: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['16'],
    color: fg.primary,
  },
  spmToggleLabel: {
    flex: 1,
    gap: space['2'],
    paddingRight: space['16'],
  },
  listHint: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['13'],
    color: fg.tertiary,
  },

  // Sheet: text input — bg/base + border/strong, radius 8 (Figma 52:9892).
  sheetInput: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['16'],
    color: fg.primary,
    backgroundColor: bg.base,
    borderWidth: 1,
    borderColor: border.strong,
    borderRadius: radii.sm,
    paddingHorizontal: space['16'],
    paddingVertical: space['14'],
  },

  // Sheet: current email display
  currentEmailText: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['18'],
    color: fg.secondary,
  },

  // Sheet: waarschuwing bij account verwijderen
  deleteWarning: {
    ...body.md,
    color: fg.secondary,
  },

  // Sheet: error message
  emailError: {
    fontFamily: fontFamily.albertSansRegular,
    fontSize: fontSize['14'],
    color: status.error,
  },

  // Sheet: date picker
  datePickerRow: {
    flexDirection: 'row',
    gap: space['12'],
  },
  // Eén doorlopende selectie-band achter de 3 kolommen (i.p.v. 3 losse pills).
  // top = (3×50 − 60)/2 = 45, centreert de band op de geselecteerde rij.
  datePickerBand: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    height: 60,
    // Zichtbare pill: bg.base (donkerder inset op de bg.raised sheet) + border.strong-rand.
    backgroundColor: bg.base,
    borderWidth: 1,
    borderColor: border.strong,
    borderRadius: radii.sm,
  },
  datePickerCol: {
    flex: 1,
  },

  // Sheet: goal fields
  sheetFieldGroup: {
    gap: space['8'],
  },
  sheetFieldLabel: {
    ...typeStyles.labelGoalPrefix,
    color: fg.tertiary,
  },
  version: {
    ...body.xs,
    color: fg.secondary,
    textAlign: 'center',
    paddingTop: space['16'],
  },
});
