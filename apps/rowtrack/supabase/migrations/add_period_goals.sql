-- Periodedoelen: week/maand-doelen opslaan in profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS period_goal_period text CHECK (period_goal_period IN ('week', 'month')),
  ADD COLUMN IF NOT EXISTS period_goal_metric text CHECK (period_goal_metric IN ('distance', 'duration', 'workouts')),
  ADD COLUMN IF NOT EXISTS period_goal_target real;

-- Consistency: alle drie ingevuld of alle drie NULL
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_period_goal_consistency CHECK (
    (period_goal_period IS NULL AND period_goal_metric IS NULL AND period_goal_target IS NULL)
    OR
    (period_goal_period IS NOT NULL AND period_goal_metric IS NOT NULL AND period_goal_target IS NOT NULL)
  );
