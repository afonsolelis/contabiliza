SELECT COALESCE(SUM(valor), 0) AS total
FROM gastos
WHERE "timestamp" >= $1 AND "timestamp" < $2;


