SELECT COALESCE(SUM(valor), 0) AS total
FROM gastos
WHERE data_efetivacao >= $1 AND data_efetivacao < $2;

