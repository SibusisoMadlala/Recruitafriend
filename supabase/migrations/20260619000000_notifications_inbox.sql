CREATE TABLE IF NOT EXISTS notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title      text NOT NULL,
  body       text,
  url        text,
  tag        text,
  read       boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "service_insert" ON notifications FOR INSERT WITH CHECK (true);
