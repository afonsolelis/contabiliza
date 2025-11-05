INSERT INTO contas (banco, agencia, conta)
VALUES ($1, $2, $3)
RETURNING id, banco, agencia, conta, "timestamp";


