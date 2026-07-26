-- v0.8.0 progress richness: real star inputs + scored game results
ALTER TABLE lesson_progress ADD COLUMN hints_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lesson_progress ADD COLUMN moves_used INTEGER;
ALTER TABLE games ADD COLUMN score_black REAL;
ALTER TABLE games ADD COLUMN score_white REAL;
