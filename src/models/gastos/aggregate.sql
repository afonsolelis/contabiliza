SELECT DATE_TRUNC($1, g."timestamp") AS period,
       SUM(g.valor) AS total
FROM gastos g
WHERE g."timestamp" >= $2 AND g."timestamp" < $3
GROUP BY period
ORDER BY period;


