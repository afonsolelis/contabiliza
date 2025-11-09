BEGIN;

ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS data_efetivacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_gastos_data_efetivacao ON gastos(data_efetivacao);

COMMIT;


