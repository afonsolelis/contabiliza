BEGIN;

CREATE TABLE IF NOT EXISTS contas (
  id SERIAL PRIMARY KEY,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  banco TEXT NOT NULL,
  agencia TEXT NOT NULL,
  conta TEXT NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gastos' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE gastos
      ADD COLUMN tipo TEXT NOT NULL DEFAULT 'pix' CHECK (tipo IN ('pix','cartao','debito'));
  END IF;
END$$;

COMMIT;


