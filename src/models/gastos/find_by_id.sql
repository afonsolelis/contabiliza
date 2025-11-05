SELECT g.id,
       g.descricao_gasto,
       g.valor,
       g.tipo,
       g.tag_id,
       g.conta_id,
       g."timestamp",
       t.tag,
       c.banco,
       c.agencia,
       c.conta
FROM gastos g
LEFT JOIN tags t ON t.id = g.tag_id
LEFT JOIN contas c ON c.id = g.conta_id
WHERE g.id = $1;


