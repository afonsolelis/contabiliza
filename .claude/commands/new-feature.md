# Nova Funcionalidade

Crie uma nova funcionalidade seguindo o padrão do projeto.

## Estrutura do Projeto

Este projeto segue uma arquitetura MVC:

```
src/
├── controllers/     # Rotas e lógica de controle
├── models/          # Queries SQL
├── views/           # Templates EJS
├── db/              # Configuração do banco de dados
└── migrations/      # Migrações SQL
```

## Passos para criar uma nova feature

### 1. Planejamento
- Defina claramente o que a feature faz
- Liste as rotas necessárias (GET, POST, etc)
- Identifique as queries SQL necessárias
- Desenhe a UI/UX

### 2. Banco de Dados (se necessário)
- Crie migration em `migrations/YYYY_MM_DD_description.sql`
- Use formato PostgreSQL
- Sempre use `IF NOT EXISTS` para segurança
- Adicione índices para performance

### 3. Queries SQL
- Crie arquivos SQL em `src/models/<entity>/`
- Use prepared statements ($1, $2, etc) para evitar SQL injection
- Nomeie arquivos de forma descritiva (list.sql, insert.sql, etc)

### 4. Controller
- Crie ou edite controller em `src/controllers/`
- Use `const router = express.Router()`
- Carregue queries com `loadSql()`
- Trate erros apropriadamente
- Valide inputs

### 5. Views
- Crie templates EJS em `src/views/`
- Use Bootstrap 5 para estilização
- Inclua `<%- include('../partials/header.ejs') %>`
- Use helpers globais: `money()`, `currency()`

### 6. Testes
- Teste manualmente todas as rotas
- Verifique edge cases
- Teste com dados inválidos
- Verifique SQL injection

### 7. Commit
- Use conventional commits: `feat(scope): description`
- Descreva o que foi adicionado
- Liste mudanças em bullet points

## Exemplo de Feature Completa

**Migration:** `migrations/2025_11_08_add_categories.sql`
```sql
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
```

**Query:** `src/models/categories/list.sql`
```sql
SELECT id, name FROM categories ORDER BY name;
```

**Controller:** `src/controllers/categoriesController.js`
```javascript
const express = require('express');
const { query, loadSql } = require('../db');
const router = express.Router();
const listSql = loadSql('categories/list.sql');

router.get('/', async (req, res) => {
  const { rows } = await query(listSql);
  res.render('categories/index', { categories: rows });
});

module.exports = { router };
```

**View:** `src/views/categories/index.ejs`
```html
<!doctype html>
<html>
<head>
  <title>Categorias</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
  <%- include('../partials/header.ejs') %>
  <div class="container">
    <h1>Categorias</h1>
    <!-- conteúdo -->
  </div>
</body>
</html>
```

## Boas Práticas

- ✅ Sempre use prepared statements
- ✅ Valide todos os inputs
- ✅ Trate todos os erros
- ✅ Use nomes descritivos
- ✅ Mantenha consistência com código existente
- ✅ Adicione comentários quando necessário
- ✅ Não hardcode credenciais
- ✅ Use variáveis de ambiente para configuração
