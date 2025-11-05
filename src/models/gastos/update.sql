UPDATE gastos
SET descricao_gasto = $2,
    valor = $3,
    tipo = $4,
    tag_id = $5,
    conta_id = $6,
    data_efetivacao = $7
WHERE id = $1;


