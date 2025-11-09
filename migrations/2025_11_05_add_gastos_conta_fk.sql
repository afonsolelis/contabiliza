BEGIN;

ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS conta_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'gastos'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'gastos_conta_id_fkey'
  ) THEN
    ALTER TABLE gastos
      ADD CONSTRAINT gastos_conta_id_fkey
      FOREIGN KEY (conta_id) REFERENCES contas(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_gastos_conta_id ON gastos(conta_id);

COMMIT;


