-- Lista gastos de um período com filtros opcionais (usado pelo assistente de chat).
-- $1 = início (UTC, inclusivo)            $2 = fim (UTC, EXCLUSIVO)
-- $3 = tag_id   (NULL = sem filtro)        $4 = tipo (NULL = sem filtro)
-- $5 = conta_id (NULL = sem filtro)
SELECT g.id,
       g.descricao_gasto,
       g.valor,
       g.tipo,
       g.data_efetivacao AS efetivado_em,
       t.tag,
       c.banco
FROM gastos g
LEFT JOIN tags t ON t.id = g.tag_id
LEFT JOIN contas c ON c.id = g.conta_id
WHERE g.data_efetivacao >= $1 AND g.data_efetivacao < $2
  AND ($3::int  IS NULL OR g.tag_id   = $3)
  AND ($4::text IS NULL OR g.tipo     = $4)
  AND ($5::int  IS NULL OR g.conta_id = $5)
ORDER BY g.data_efetivacao DESC
LIMIT 200;
