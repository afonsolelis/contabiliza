SELECT g.id,
       g.descricao_gasto,
       g.valor,
       g.tag_id,
       g.tipo,
       g.data_efetivacao AS efetivado_em,
       g.conta_id,
       t.tag,
       c.banco,
       c.agencia,
       c.conta
FROM gastos g
LEFT JOIN tags t ON t.id = g.tag_id
LEFT JOIN contas c ON c.id = g.conta_id
WHERE g.data_efetivacao >= $1
  AND g.data_efetivacao < $2
  AND (
    ($3::text IS NOT NULL AND t.tag = $3)
    OR ($3::text IS NULL AND t.tag IS NULL)
  )
ORDER BY g.data_efetivacao DESC;
