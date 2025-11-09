INSERT INTO gastos (descricao_gasto, valor, tag_id, tipo, conta_id, data_efetivacao, parcela_numero, parcela_total, parcela_grupo_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, descricao_gasto, valor, tag_id, tipo, conta_id, data_efetivacao, parcela_numero, parcela_total, parcela_grupo_id, "timestamp";


