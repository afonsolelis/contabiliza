SELECT
  c.id,
  c.banco,
  c.agencia,
  c.conta,
  SUM(g.valor) AS total
FROM gastos g
JOIN contas c ON c.id = g.conta_id
WHERE g.data_efetivacao >= $1 AND g.data_efetivacao < $2
GROUP BY c.id, c.banco, c.agencia, c.conta
ORDER BY total DESC;
