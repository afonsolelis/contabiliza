INSERT INTO gastos (descricao_gasto, valor, tag_id, tipo, conta_id, data_efetivacao)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, descricao_gasto, valor, tag_id, tipo, conta_id, data_efetivacao, "timestamp";


