CREATE TABLE interview_ai_notes (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id           uuid REFERENCES applications(id) ON DELETE SET NULL,
  created_by               uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at               timestamptz DEFAULT now(),
  interview_date           date,
  candidate_name           text,
  job_title                text,
  transcript               text,
  summary                  text,
  key_points               text[] DEFAULT '{}',
  skills                   text[] DEFAULT '{}',
  qualifications           text[] DEFAULT '{}',
  experience               text[] DEFAULT '{}',
  strengths                text[] DEFAULT '{}',
  concerns                 text[] DEFAULT '{}',
  action_items             text[] DEFAULT '{}',
  recommendation           text,
  salary_expectations      text DEFAULT 'Not discussed',
  availability             text DEFAULT 'Not discussed',
  score_communication      int CHECK (score_communication >= 0 AND score_communication <= 100),
  score_technical          int CHECK (score_technical >= 0 AND score_technical <= 100),
  score_experience_relevance int CHECK (score_experience_relevance >= 0 AND score_experience_relevance <= 100),
  score_confidence         int CHECK (score_confidence >= 0 AND score_confidence <= 100),
  score_overall            int CHECK (score_overall >= 0 AND score_overall <= 100)
);

ALTER TABLE interview_ai_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON interview_ai_notes
  FOR ALL USING (auth.uid() = created_by);
