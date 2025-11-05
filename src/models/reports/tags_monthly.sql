WITH months AS (
  SELECT tag_id,
         EXTRACT(MONTH FROM data_efetivacao)::int AS m,
         SUM(valor) AS total
  FROM gastos
  WHERE EXTRACT(YEAR FROM data_efetivacao) = $1
  GROUP BY tag_id, m
),
labels AS (
  SELECT id::int AS tag_id, tag::text AS tag FROM tags
  UNION ALL
  SELECT NULL::int AS tag_id, '— sem tag —'::text AS tag
)
SELECT l.tag_id,
       l.tag,
       COALESCE(SUM(CASE WHEN m.m = 1 THEN m.total ELSE 0 END), 0) AS jan,
       COALESCE(SUM(CASE WHEN m.m = 2 THEN m.total ELSE 0 END), 0) AS fev,
       COALESCE(SUM(CASE WHEN m.m = 3 THEN m.total ELSE 0 END), 0) AS mar,
       COALESCE(SUM(CASE WHEN m.m = 4 THEN m.total ELSE 0 END), 0) AS abr,
       COALESCE(SUM(CASE WHEN m.m = 5 THEN m.total ELSE 0 END), 0) AS mai,
       COALESCE(SUM(CASE WHEN m.m = 6 THEN m.total ELSE 0 END), 0) AS jun,
       COALESCE(SUM(CASE WHEN m.m = 7 THEN m.total ELSE 0 END), 0) AS jul,
       COALESCE(SUM(CASE WHEN m.m = 8 THEN m.total ELSE 0 END), 0) AS ago,
       COALESCE(SUM(CASE WHEN m.m = 9 THEN m.total ELSE 0 END), 0) AS setem,
       COALESCE(SUM(CASE WHEN m.m = 10 THEN m.total ELSE 0 END), 0) AS out,
       COALESCE(SUM(CASE WHEN m.m = 11 THEN m.total ELSE 0 END), 0) AS nov,
       COALESCE(SUM(CASE WHEN m.m = 12 THEN m.total ELSE 0 END), 0) AS dez
FROM labels l
LEFT JOIN months m
  ON m.tag_id IS NOT DISTINCT FROM l.tag_id
GROUP BY l.tag_id, l.tag
ORDER BY l.tag;
