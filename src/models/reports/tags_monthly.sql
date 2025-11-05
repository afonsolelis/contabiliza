WITH filtered AS (
  SELECT tag_id, valor, data_efetivacao
  FROM gastos
  WHERE EXTRACT(YEAR FROM data_efetivacao) = $1
)
SELECT t.id AS tag_id,
       t.tag AS tag,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 1 THEN f.valor ELSE 0 END) AS jan,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 2 THEN f.valor ELSE 0 END) AS fev,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 3 THEN f.valor ELSE 0 END) AS mar,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 4 THEN f.valor ELSE 0 END) AS abr,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 5 THEN f.valor ELSE 0 END) AS mai,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 6 THEN f.valor ELSE 0 END) AS jun,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 7 THEN f.valor ELSE 0 END) AS jul,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 8 THEN f.valor ELSE 0 END) AS ago,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 9 THEN f.valor ELSE 0 END) AS setem,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 10 THEN f.valor ELSE 0 END) AS out,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 11 THEN f.valor ELSE 0 END) AS nov,
       SUM(CASE WHEN EXTRACT(MONTH FROM f.data_efetivacao) = 12 THEN f.valor ELSE 0 END) AS dez
FROM tags t
LEFT JOIN filtered f ON f.tag_id = t.id
GROUP BY t.id, t.tag

UNION ALL

SELECT NULL AS tag_id,
       '— sem tag —' AS tag,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 1 THEN g.valor ELSE 0 END) AS jan,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 2 THEN g.valor ELSE 0 END) AS fev,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 3 THEN g.valor ELSE 0 END) AS mar,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 4 THEN g.valor ELSE 0 END) AS abr,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 5 THEN g.valor ELSE 0 END) AS mai,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 6 THEN g.valor ELSE 0 END) AS jun,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 7 THEN g.valor ELSE 0 END) AS jul,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 8 THEN g.valor ELSE 0 END) AS ago,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 9 THEN g.valor ELSE 0 END) AS setem,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 10 THEN g.valor ELSE 0 END) AS out,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 11 THEN g.valor ELSE 0 END) AS nov,
       SUM(CASE WHEN EXTRACT(MONTH FROM g.data_efetivacao) = 12 THEN g.valor ELSE 0 END) AS dez
FROM gastos g
WHERE EXTRACT(YEAR FROM g.data_efetivacao) = $1 AND g.tag_id IS NULL
GROUP BY 1, 2
ORDER BY tag;
