SELECT
  COALESCE(t.tag, '— sem tag —') AS tag,
  SUM(g.valor) AS total
FROM gastos g
LEFT JOIN tags t
  ON t.id = g.tag_id
WHERE g.data_efetivacao >= $1
  AND g.data_efetivacao < $2
GROUP BY COALESCE(t.tag, '— sem tag —')
ORDER BY total DESC;
