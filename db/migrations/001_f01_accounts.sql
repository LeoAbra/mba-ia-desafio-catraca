-- F01 Fundação e Contas: usuários (participantes e organizadores) e sessões.
CREATE TABLE users (
  id            text PRIMARY KEY,
  name          text NOT NULL CHECK (length(trim(name)) > 0),
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('participant', 'organizer')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token      text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
