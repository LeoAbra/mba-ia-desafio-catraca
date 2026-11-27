-- F03 Compra e Gateway: ingressos e tentativas de pagamento.
CREATE TABLE tickets (
  id            text PRIMARY KEY,
  event_id      text NOT NULL REFERENCES events(id),
  code          text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{8}$'),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled', 'refunded')),
  price_cents   integer NOT NULL CHECK (price_cents > 0),
  channel       text NOT NULL CHECK (channel IN ('storefront', 'partner')),
  user_id       text REFERENCES users(id),
  buyer_email   text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  checked_in_at timestamptz
);

CREATE INDEX tickets_event_status_idx ON tickets(event_id, status);
CREATE INDEX tickets_user_idx ON tickets(user_id, created_at);

CREATE TABLE payments (
  id           text PRIMARY KEY,
  ticket_id    text NOT NULL UNIQUE REFERENCES tickets(id),
  card_last4   text NOT NULL CHECK (card_last4 ~ '^[0-9]{4}$'),
  status       text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'approved', 'declined')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX payments_processing_idx ON payments(status) WHERE status = 'processing';
