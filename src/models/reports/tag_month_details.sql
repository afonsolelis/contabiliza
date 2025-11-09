SELECT
  g.id,
  g.descricao_gasto,
  g.valor,
  g.data_efetivacao,
  g."timestamp" AS data_lancamento,
  t.tag,
  c.banco,
  c.agencia,
  c.conta,
  g.tipo
FROM gastos g
LEFT JOIN tags t ON g.tag_id = t.id
LEFT JOIN contas c ON g.conta_id = c.id
WHERE EXTRACT(YEAR FROM g.data_efetivacao) = $1
  AND EXTRACT(MONTH FROM g.data_efetivacao) = $2
  AND g.tag_id IS NOT DISTINCT FROM $3
ORDER BY g.data_efetivacao DESC, g.id DESC;
