-- Add workout goal columns to workouts table
ALTER TABLE public.workouts
  ADD COLUMN goal_type text CHECK (goal_type IN ('duration', 'distance', 'split', 'watts')),
  ADD COLUMN goal_target real,
  ADD COLUMN goal_reached boolean;

-- Constraint: goal columns must all be set or all be null
ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_goal_consistency CHECK (
    (goal_type IS NULL AND goal_target IS NULL AND goal_reached IS NULL)
    OR
    (goal_type IS NOT NULL AND goal_target IS NOT NULL AND goal_reached IS NOT NULL)
  );

-- Add splits column for 500m split tracking
ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS splits jsonb;
