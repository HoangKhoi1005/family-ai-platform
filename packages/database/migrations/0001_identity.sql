-- Foundation only. No grants for runtime roles until verified authentication is implemented.
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE family_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE family_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, user_id),
  UNIQUE(family_id, id)
);
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  birth_date date,
  birth_year integer CHECK (birth_year BETWEEN 1 AND 9999),
  deceased boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (birth_date IS NULL OR birth_year IS NULL OR EXTRACT(YEAR FROM birth_date) = birth_year),
  UNIQUE(family_id, id)
);
CREATE TABLE member_account_links (
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  membership_id uuid NOT NULL,
  member_id uuid NOT NULL,
  PRIMARY KEY(family_id, membership_id),
  UNIQUE(family_id, member_id),
  FOREIGN KEY(family_id, membership_id) REFERENCES family_memberships(family_id, id),
  FOREIGN KEY(family_id, member_id) REFERENCES members(family_id, id)
);
CREATE TABLE member_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  member_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('phone', 'email', 'facebook')),
  value text NOT NULL CHECK (length(trim(value)) > 0),
  visibility text NOT NULL DEFAULT 'self' CHECK (visibility IN ('self', 'family')),
  FOREIGN KEY(family_id, member_id) REFERENCES members(family_id, id)
);
CREATE INDEX memberships_user_status ON family_memberships(user_id, status);
CREATE INDEX members_family_name ON members(family_id, display_name, id);
CREATE INDEX contacts_member ON member_contacts(family_id, member_id);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE family_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_spaces FORCE ROW LEVEL SECURITY;
ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE members FORCE ROW LEVEL SECURITY;
ALTER TABLE member_account_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_account_links FORCE ROW LEVEL SECURITY;
ALTER TABLE member_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_contacts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON users, family_spaces, family_memberships, members, member_account_links, member_contacts FROM PUBLIC;
