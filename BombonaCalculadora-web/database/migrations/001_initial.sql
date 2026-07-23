CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  yield_rate NUMERIC(8,6) NOT NULL DEFAULT 0.95 CHECK (yield_rate > 0 AND yield_rate <= 1),
  rounding_policy TEXT NOT NULL DEFAULT 'truncar' CHECK (rounding_policy IN ('truncar', 'arredondar')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS containers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tare_kg NUMERIC(12,3) NOT NULL CHECK (tare_kg >= 0),
  color CHAR(7) NOT NULL CHECK (color ~ '^#[0-9A-F]{6}$'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO containers (id, name, tare_kg, color, active, sort_order) VALUES
  ('bombona-azul', 'Bombona Azul', 6.400, '#2563EB', TRUE, 0),
  ('bombona-marrom', 'Bombona Marrom', 9.200, '#8B5A2B', TRUE, 1),
  ('caixa-vermelha', 'Caixa Vermelha', 3.000, '#EF4444', TRUE, 2),
  ('galao', 'Galão', 1.000, '#06B6D4', TRUE, 3)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS calculations (
  id UUID PRIMARY KEY,
  product_id VARCHAR(60) NOT NULL CHECK (product_id = UPPER(product_id)),
  address VARCHAR(100) NOT NULL CHECK (address = UPPER(address)),
  container_id TEXT NOT NULL,
  container_name TEXT NOT NULL,
  container_tare_kg NUMERIC(12,3) NOT NULL CHECK (container_tare_kg >= 0),
  container_color CHAR(7) NOT NULL,
  gross_weight_kg NUMERIC(14,3) NOT NULL CHECK (gross_weight_kg >= 0),
  unit_weight_g NUMERIC(14,3) NOT NULL CHECK (unit_weight_g > 0),
  net_weight_kg NUMERIC(14,3) NOT NULL CHECK (net_weight_kg >= 0),
  yield_rate NUMERIC(8,6) NOT NULL CHECK (yield_rate > 0 AND yield_rate <= 1),
  rounding_policy TEXT NOT NULL CHECK (rounding_policy IN ('truncar', 'arredondar')),
  original_quantity INTEGER NOT NULL CHECK (original_quantity >= 0),
  final_quantity INTEGER NOT NULL CHECK (final_quantity >= 0),
  formula_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by_client VARCHAR(100) NOT NULL,
  updated_by_client VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calculations_product_id ON calculations (product_id text_pattern_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calculations_created_at ON calculations (created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS calculation_revisions (
  id UUID PRIMARY KEY,
  calculation_id UUID NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  changed_by_client VARCHAR(100) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_values JSONB NOT NULL,
  new_values JSONB NOT NULL,
  UNIQUE (calculation_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_calculation_revisions_calculation ON calculation_revisions (calculation_id, revision_number DESC);
