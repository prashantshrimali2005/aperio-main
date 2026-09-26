-- Per-course and per-set pricing (whole INR; 0 = free) + a payments ledger.
ALTER TABLE courses        ADD COLUMN IF NOT EXISTS price_inr integer NOT NULL DEFAULT 0 CHECK (price_inr >= 0);
ALTER TABLE question_sets  ADD COLUMN IF NOT EXISTS price_inr integer NOT NULL DEFAULT 0 CHECK (price_inr >= 0);

CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('course', 'question_set')),
  item_id text NOT NULL,
  amount_inr integer NOT NULL CHECK (amount_inr >= 0),
  currency text NOT NULL DEFAULT 'INR',
  provider text NOT NULL DEFAULT 'razorpay',
  order_id text,
  payment_id text,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_paid_item_idx ON payments(user_id, item_type, item_id) WHERE status = 'paid';
