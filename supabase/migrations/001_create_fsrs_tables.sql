-- FSRS (Free Spaced Repetition Scheduler) Table Schema
--
-- This migration script replaces the old SM-2 based study progress
-- with tables designed for the FSRS algorithm.

-- Step 1: Create the main FSRS progress table
-- This table stores the FSRS card state for each vocabulary item per user.
CREATE TABLE fsrs_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    vocabulary_id UUID NOT NULL REFERENCES words(id),

    -- Core FSRS Fields
    due TIMESTAMPTZ NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    elapsed_days INTEGER NOT NULL DEFAULT 0,
    scheduled_days INTEGER NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    state INTEGER NOT NULL, -- Corresponds to FSRS State enum (0:New, 1:Learning, 2:Review, 3:Relearning)
    last_review TIMESTAMPTZ,
    learning_steps INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE (user_id, vocabulary_id)
);

-- Indexes
CREATE INDEX idx_fsrs_progress_due ON fsrs_progress (user_id, due);

-- RLS Policy for fsrs_progress
ALTER TABLE fsrs_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own FSRS progress"
    ON fsrs_progress
    FOR ALL
    USING (auth.uid() = user_id);


-- Step 2: Create the review logs table (optional but highly recommended)
-- This table stores a log of every review, which is essential for
-- debugging, analytics, and for using the FSRS optimizer in the future.
CREATE TABLE fsrs_review_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    progress_id UUID NOT NULL REFERENCES fsrs_progress(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- FSRS Log Fields
    rating INTEGER NOT NULL, -- Corresponds to FSRS Rating enum (1:Again, 2:Hard, 3:Good, 4:Easy)
    state INTEGER NOT NULL,
    due TIMESTAMPTZ NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    elapsed_days INTEGER NOT NULL,
    last_elapsed_days INTEGER NOT NULL,
    scheduled_days INTEGER NOT NULL,
    review TIMESTAMPTZ NOT NULL,
    learning_steps INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy for fsrs_review_logs
ALTER TABLE fsrs_review_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own review logs"
    ON fsrs_review_logs
    FOR ALL
    USING (auth.uid() = user_id);

-- Add a function to automatically update the `updated_at` timestamp
CREATE OR REPLACE FUNCTION handle_fsrs_progress_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_fsrs_progress_update
    BEFORE UPDATE ON fsrs_progress
    FOR EACH ROW
    EXECUTE FUNCTION handle_fsrs_progress_update();