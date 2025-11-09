# Debug

Ajude a debugar problemas na aplicação.

## Passos para Debug

### 1. Identifique o Problema
- Qual é o erro exato?
- Quando ele ocorre?
- Como reproduzir?
- O que mudou recentemente?

### 2. Colete Informações
```bash
# Logs do servidor
tail -f logs/app.log

# Logs do PostgreSQL (se local)
tail -f /var/log/postgresql/postgresql.log

# Status do servidor
curl -I http://localhost:3000

# Verificar processos
ps aux | grep node
```

### 3. Verifique Configuração

**Variáveis de Ambiente:**
```bash
cat .env
```

**Banco de dados:**
```bash
# Conectar ao banco
psql $DATABASE_URL

# Verificar tabelas
\dt

# Verificar dados
SELECT * FROM gastos LIMIT 5;
```

### 4. Erros Comuns

**Erro de conexão com banco:**
- Verifique DATABASE_URL no .env
- Confirme que o banco está rodando
- Verifique credenciais

**Coluna não existe:**
- Execute migrations: `node src/db/migrate.js`
- Verifique schema da tabela: `\d table_name` no psql

**Porta em uso:**
- Mude PORT no .env
- Ou mate o processo: `lsof -ti:3000 | xargs kill -9`

**Módulo não encontrado:**
- Execute: `npm install`
- Verifique package.json

**Erro de SQL:**
- Teste query diretamente no psql
- Verifique prepared statements ($1, $2)
- Confira tipos de dados

### 5. Debugging no Código

**Adicione logs temporários:**
```javascript
console.log('DEBUG:', variable);
console.error('ERROR:', error);
```

**Use try-catch:**
```javascript
try {
  // código
} catch (err) {
  console.error('Erro detalhado:', err);
  throw err;
}
```

**Node debugger:**
```bash
node --inspect server.js
```

### 6. Testes de Sanidade

```bash
# Servidor responde?
curl http://localhost:3000

# Banco conecta?
node -e "require('./src/db').pool.query('SELECT 1').then(() => console.log('OK'))"

# Migrations rodaram?
psql $DATABASE_URL -c "\dt"
```

### 7. Performance

**Queries lentas:**
```sql
EXPLAIN ANALYZE SELECT * FROM gastos WHERE ...;
```

**Adicione índices:**
```sql
CREATE INDEX idx_gastos_data ON gastos(data_efetivacao);
```

## Checklist de Debug

- ✅ Erro identificado e reproduzível
- ✅ Logs coletados e analisados
- ✅ Configuração verificada
- ✅ Código testado localmente
- ✅ Causa raiz identificada
- ✅ Correção aplicada
- ✅ Teste de regressão feito
