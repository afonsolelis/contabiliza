-- Soma e contagem de gastos de um período com filtros opcionais (assistente de chat).
-- Mesmos parâmetros de query_flexible.sql.
-- $1 = início (UTC, inclusivo)            $2 = fim (UTC, EXCLUSIVO)
-- $3 = tag_id   (NULL = sem filtro)        $4 = tipo (NULL = sem filtro)
-- $5 = conta_id (NULL = sem filtro)
SELECT COALESCE(SUM(g.valor), 0) AS total,
       COUNT(*) AS qtd
FROM gastos g
WHERE g.data_efetivacao >= $1 AND g.data_efetivacao < $2
  AND ($3::int  IS NULL OR g.tag_id   = $3)
  AND ($4::text IS NULL OR g.tipo     = $4)
  AND ($5::int  IS NULL OR g.conta_id = $5);
