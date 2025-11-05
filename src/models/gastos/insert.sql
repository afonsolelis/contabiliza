INSERT INTO gastos (descricao_gasto, valor, tag_id, tipo, conta_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, descricao_gasto, valor, tag_id, tipo, conta_id, "timestamp";


