-- Verificação de duplicatas antes de inserir um gasto (ver specs/input_gastos.md).
-- $1 = termo-chave da descrição com curingas (ex: '%mercado%')
-- $2 = valor exato informado
-- $3 = início da janela de datas (data informada - 3 dias, UTC)
-- $4 = fim EXCLUSIVO da janela (data informada + 4 dias, UTC) — fim exclusivo por convenção do projeto
SELECT g.id,
       g.descricao_gasto,
       g.valor,
       g.data_efetivacao AS efetivado_em,
       g.tipo,
       g.conta_id,
       g.parcela_numero,
       g.parcela_total,
       t.tag
FROM gastos g
LEFT JOIN tags t ON t.id = g.tag_id
WHERE g.descricao_gasto ILIKE $1
   OR (g.valor = $2 AND g.data_efetivacao >= $3 AND g.data_efetivacao < $4)
ORDER BY g.data_efetivacao DESC
LIMIT 10;
