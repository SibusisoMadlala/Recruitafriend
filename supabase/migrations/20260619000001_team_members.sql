CREATE TABLE IF NOT EXISTS team_members (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  member_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  member_email text NOT NULL,
  member_name  text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(owner_id, member_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "owner_all" ON team_members FOR ALL USING (auth.uid() = owner_id);
-- Members can read their own membership
CREATE POLICY "member_read" ON team_members FOR SELECT USING (auth.uid() = member_id);
