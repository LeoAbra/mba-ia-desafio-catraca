-- F02 Gestão de Eventos. Status 'cancelled' já existe no modelo (F07 faz a transição).
CREATE TABLE events (
  id           text PRIMARY KEY,
  organizer_id text NOT NULL REFERENCES users(id),
  name         text NOT NULL CHECK (length(trim(name)) > 0),
  starts_at    timestamptz NOT NULL,
  venue        text NOT NULL CHECK (length(trim(venue)) > 0),
  capacity     integer NOT NULL CHECK (capacity >= 1),
  price_cents  integer NOT NULL CHECK (price_cents > 0),
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX events_organizer_idx ON events(organizer_id, starts_at);
CREATE INDEX events_status_idx ON events(status, starts_at);
