-- =============================================================================
-- BorrowBox — Supabase Schema Migration
-- Apply this entire file in the Supabase SQL Editor.
-- =============================================================================

-- STORAGE BUCKET NOTE:
-- The `item-images` bucket cannot be created via SQL on the Supabase free tier.
-- Create it manually:
--   1. Go to Storage in the Supabase dashboard.
--   2. Click "New bucket", name it `item-images`, and enable "Public bucket".
--
-- After creating the bucket, run the following Storage policies separately
-- (Supabase Storage > item-images > Policies):
--
--   CREATE POLICY "Public read item-images"
--     ON storage.objects FOR SELECT
--     USING (bucket_id = 'item-images');
--
--   CREATE POLICY "Auth users can upload item-images"
--     ON storage.objects FOR INSERT
--     TO authenticated
--     WITH CHECK (bucket_id = 'item-images');
--
--   CREATE POLICY "Owner can delete own item-images"
--     ON storage.objects FOR DELETE
--     TO authenticated
--     USING (
--       bucket_id = 'item-images'
--       AND (storage.foldername(name))[1] = auth.uid()::text
--     );
-- =============================================================================


-- ---------------------------------------------------------------------------
-- TABLE: profiles
-- ---------------------------------------------------------------------------

CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text UNIQUE,
  campus     text,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- AUTO-PROFILE TRIGGER
-- Inserts a bare profiles row whenever a new auth.users row is created.
-- SECURITY DEFINER lets the function write to profiles even though the
-- calling context originates from the auth schema.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------------------------------------------------------------------------
-- TABLE: items
-- ---------------------------------------------------------------------------

CREATE TABLE items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  description text,
  category    text,
  type        text CHECK (type IN ('lend', 'donate')) NOT NULL,
  status      text CHECK (status IN ('available', 'borrowed')) DEFAULT 'available' NOT NULL,
  image_url   text,
  created_at  timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- TABLE: borrow_requests
-- ---------------------------------------------------------------------------

CREATE TABLE borrow_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  requester_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status       text CHECK (status IN ('pending', 'approved', 'rejected', 'borrowed', 'return_requested', 'returned')) DEFAULT 'pending' NOT NULL,
  message      text,
  created_at   timestamptz DEFAULT now(),
  returned_at  timestamptz
);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrow_requests ENABLE ROW LEVEL SECURITY;

-- profiles -------------------------------------------------------------------

CREATE POLICY "Profiles: anyone can read"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Profiles: user can insert own row"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles: user can update own row"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- items ----------------------------------------------------------------------

CREATE POLICY "Items: anyone can read"
  ON items FOR SELECT
  USING (true);

CREATE POLICY "Items: authenticated users can insert own items"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Items: owner can update"
  ON items FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Items: owner can delete"
  ON items FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- borrow_requests ------------------------------------------------------------

CREATE POLICY "Requests: requester can insert"
  ON borrow_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Requests: requester can read own"
  ON borrow_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id);

CREATE POLICY "Requests: item owner can read requests on their items"
  ON borrow_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (SELECT owner_id FROM items WHERE id = item_id)
  );

CREATE POLICY "Requests: item owner can update status"
  ON borrow_requests FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (SELECT owner_id FROM items WHERE id = item_id)
  );

CREATE POLICY "Requests: requester can update own"
  ON borrow_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id);
