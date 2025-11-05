SELECT DATE_TRUNC($1, g.data_efetivacao) AS period,
       SUM(g.valor) AS total
FROM gastos g
WHERE g.data_efetivacao >= $2 AND g.data_efetivacao < $3
GROUP BY period
ORDER BY period;


