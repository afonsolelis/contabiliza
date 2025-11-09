-- Adiciona suporte para pagamento parcelado
-- MIGRAÇÃO SEGURA: apenas adiciona colunas, não remove nem altera dados existentes
-- Executar este script manualmente no banco de dados PostgreSQL

-- Adicionar colunas para controle de parcelas
-- Todas as colunas são opcionais (NULL) para não afetar registros existentes
ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS parcela_numero INTEGER,
ADD COLUMN IF NOT EXISTS parcela_total INTEGER,
ADD COLUMN IF NOT EXISTS parcela_grupo_id UUID;

-- Comentários das colunas
COMMENT ON COLUMN gastos.parcela_numero IS 'Número da parcela atual (1, 2, 3, etc.). NULL se não for parcelado';
COMMENT ON COLUMN gastos.parcela_total IS 'Total de parcelas. NULL se não for parcelado';
COMMENT ON COLUMN gastos.parcela_grupo_id IS 'UUID para agrupar todas as parcelas de uma mesma compra. NULL se não for parcelado';

-- Verificação: mostrar estrutura da tabela após migração
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'gastos'
ORDER BY ordinal_position;
