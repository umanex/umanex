import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button, FormField, SectionHeader } from '@/components';
import type { PeriodGoalPeriod, PeriodGoalMetric } from '@/lib/hooks/usePeriodGoal';
import {
  background,
  brand,
  text as textColors,
  display,
  body,
  label,
  space,
  layout,
  fontFamily,
  fontSize,
  radii,
} from '@/constants';

export default function ProfileScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [origGender, setOrigGender] = useState<string | null>(null);
  const [age, setAge] = useState('');
  const [origAge, setOrigAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [origWeightKg, setOrigWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [origHeightCm, setOrigHeightCm] = useState('');
  const [goalPeriod, setGoalPeriod] = useState<PeriodGoalPeriod | null>(null);
  const [origGoalPeriod, setOrigGoalPeriod] = useState<PeriodGoalPeriod | null>(null);
  const [goalMetric, setGoalMetric] = useState<PeriodGoalMetric | null>(null);
  const [origGoalMetric, setOrigGoalMetric] = useState<PeriodGoalMetric | null>(null);
  const [goalTarget, setGoalTarget] = useState('');
  const [origGoalTarget, setOrigGoalTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name, gender, age, weight_kg, height_cm, period_goal_period, period_goal_metric, period_goal_target')
      .eq('id', user.id)
      .single();
    const name = data?.display_name ?? '';
    setDisplayName(name);
    setOriginalName(name);
    setGender(data?.gender ?? null);
    setOrigGender(data?.gender ?? null);
    const a = data?.age != null ? String(data.age) : '';
    setAge(a);
    setOrigAge(a);
    const w = data?.weight_kg != null ? String(data.weight_kg) : '';
    setWeightKg(w);
    setOrigWeightKg(w);
    const h = data?.height_cm != null ? String(data.height_cm) : '';
    setHeightCm(h);
    setOrigHeightCm(h);
    const gp = (data?.period_goal_period as PeriodGoalPeriod) ?? null;
    setGoalPeriod(gp);
    setOrigGoalPeriod(gp);
    const gm = (data?.period_goal_metric as PeriodGoalMetric) ?? null;
    setGoalMetric(gm);
    setOrigGoalMetric(gm);
    // Convert stored value to user-friendly units (meters→km, seconds→min)
    let gt = '';
    if (data?.period_goal_target != null && gm) {
      if (gm === 'distance') gt = String(data.period_goal_target / 1000);
      else if (gm === 'duration') gt = String(data.period_goal_target / 60);
      else gt = String(data.period_goal_target);
    }
    setGoalTarget(gt);
    setOrigGoalTarget(gt);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );

  const hasChanges =
    displayName !== originalName ||
    gender !== origGender ||
    age !== origAge ||
    weightKg !== origWeightKg ||
    heightCm !== origHeightCm ||
    goalPeriod !== origGoalPeriod ||
    goalMetric !== origGoalMetric ||
    goalTarget !== origGoalTarget;

  async function handleSave() {
    if (!user || !hasChanges) return;
    setSaving(true);

    const hasGoal = goalPeriod && goalMetric && goalTarget;
    let goalTargetStored: number | null = null;
    if (hasGoal) {
      const raw = parseFloat(goalTarget);
      if (goalMetric === 'distance') goalTargetStored = raw * 1000; // km → meters
      else if (goalMetric === 'duration') goalTargetStored = raw * 60; // min → seconds
      else goalTargetStored = raw; // workouts count
    }
    const payload = {
      display_name: displayName.trim(),
      gender: gender || null,
      age: age ? parseInt(age, 10) : null,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
      height_cm: heightCm ? parseInt(heightCm, 10) : null,
      period_goal_period: hasGoal ? goalPeriod : null,
      period_goal_metric: hasGoal ? goalMetric : null,
      period_goal_target: goalTargetStored,
    };

    if (__DEV__) console.log('[Profile] saving:', payload);

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id);
    setSaving(false);

    if (error) {
      if (__DEV__) console.log('[Profile] save error:', JSON.stringify(error));
      Alert.alert('Fout', `Opslaan mislukt: ${error.message}`);
    } else {
      setOriginalName(displayName.trim());
      setDisplayName(displayName.trim());
      setOrigGender(gender);
      setOrigAge(age);
      setOrigWeightKg(weightKg);
      setOrigHeightCm(heightCm);
      setOrigGoalPeriod(goalPeriod);
      setOrigGoalMetric(goalMetric);
      setOrigGoalTarget(goalTarget);
    }
  }

  function handleLogout() {
    Alert.alert('Uitloggen', 'Weet je zeker dat je wilt uitloggen?', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Uitloggen', style: 'destructive', onPress: signOut },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={brand.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Profiel</Text>

      <FormField
        label="E-MAIL"
        value={user?.email ?? ''}
        readOnly
      />

      <FormField
        label="NAAM"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Je weergavenaam"
        autoCapitalize="words"
        autoCorrect={false}
      />

      <SectionHeader title="Lichaamsgegevens" />

      {/* Gender segmented control */}
      <View style={styles.fieldWithLabel}>
        <Text style={styles.fieldLabel}>GESLACHT</Text>
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segment, gender === 'male' && styles.segmentActive]}
            onPress={() => setGender('male')}
          >
            <Text style={[styles.segmentText, gender === 'male' && styles.segmentTextActive]}>Man</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, gender === 'female' && styles.segmentActive]}
            onPress={() => setGender('female')}
          >
            <Text style={[styles.segmentText, gender === 'female' && styles.segmentTextActive]}>Vrouw</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FormField
        label="LEEFTIJD"
        value={age}
        onChangeText={setAge}
        placeholder="jaar"
        keyboardType="numeric"
      />

      <FormField
        label="GEWICHT"
        value={weightKg}
        onChangeText={setWeightKg}
        placeholder="kg"
        keyboardType="decimal-pad"
      />

      <FormField
        label="LENGTE"
        value={heightCm}
        onChangeText={setHeightCm}
        placeholder="cm"
        keyboardType="numeric"
      />

      <SectionHeader title="Periodedoel" />

      {/* Period: week / maand */}
      <View style={styles.fieldWithLabel}>
        <Text style={styles.fieldLabel}>PERIODE</Text>
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segment, goalPeriod === 'week' && styles.segmentActive]}
            onPress={() => setGoalPeriod('week')}
          >
            <Text style={[styles.segmentText, goalPeriod === 'week' && styles.segmentTextActive]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, goalPeriod === 'month' && styles.segmentActive]}
            onPress={() => setGoalPeriod('month')}
          >
            <Text style={[styles.segmentText, goalPeriod === 'month' && styles.segmentTextActive]}>Maand</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Metric: afstand / duur / workouts */}
      <View style={styles.fieldWithLabel}>
        <Text style={styles.fieldLabel}>DOEL TYPE</Text>
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segment, goalMetric === 'distance' && styles.segmentActive]}
            onPress={() => setGoalMetric('distance')}
          >
            <Text style={[styles.segmentText, goalMetric === 'distance' && styles.segmentTextActive]}>Afstand</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, goalMetric === 'duration' && styles.segmentActive]}
            onPress={() => setGoalMetric('duration')}
          >
            <Text style={[styles.segmentText, goalMetric === 'duration' && styles.segmentTextActive]}>Duur</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, goalMetric === 'workouts' && styles.segmentActive]}
            onPress={() => setGoalMetric('workouts')}
          >
            <Text style={[styles.segmentText, goalMetric === 'workouts' && styles.segmentTextActive]}>Sessies</Text>
          </TouchableOpacity>
        </View>
      </View>

      {goalMetric && (
        <FormField
          label="DOEL"
          value={goalTarget}
          onChangeText={setGoalTarget}
          placeholder={goalMetric === 'distance' ? 'km' : goalMetric === 'duration' ? 'minuten' : 'aantal'}
          keyboardType="numeric"
        />
      )}

      {hasChanges && (
        <Button
          title="Opslaan"
          onPress={handleSave}
          loading={saving}
          size="md"
        />
      )}

      <View style={styles.spacer} />

      <Button
        title="Uitloggen"
        onPress={handleLogout}
        variant="destructive"
        size="md"
      />

      <Text style={styles.version}>RowTrack v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: background.base,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: layout.screenHorizontal,
    paddingBottom: space[10],
    gap: space[5],
  },
  title: {
    ...display.sm,
    color: textColors.primary,
    paddingTop: space[6],
  },
  fieldWithLabel: {
    gap: space[2],
  },
  fieldLabel: {
    ...label.caps,
    color: textColors.muted,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: background.surface,
    borderRadius: radii.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[2],
    borderRadius: radii.sm,
  },
  segmentActive: {
    backgroundColor: brand.primary,
  },
  segmentText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['14'],
    color: textColors.muted,
  },
  segmentTextActive: {
    color: background.base,
  },
  spacer: {
    flex: 1,
    minHeight: space[8],
  },
  version: {
    ...body.xs,
    color: textColors.muted,
    textAlign: 'center',
    paddingTop: space[4],
  },
});
