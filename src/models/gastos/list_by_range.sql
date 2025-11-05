SELECT g.id,
       g.descricao_gasto,
       g.valor,
       g.tag_id,
       g.tipo,
       g."timestamp",
       g.conta_id,
       t.tag,
       c.banco,
       c.agencia,
       c.conta
FROM gastos g
LEFT JOIN tags t ON t.id = g.tag_id
LEFT JOIN contas c ON c.id = g.conta_id
WHERE g."timestamp" >= $1 AND g."timestamp" < $2
ORDER BY g."timestamp" DESC;


