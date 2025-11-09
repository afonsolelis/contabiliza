# Code Style

Regras de estilo e boas práticas para código neste projeto.

## Princípios Fundamentais

### 1. Código Bom é Código Sem Comentário

**Código deve ser auto-explicativo através de:**
- Nomes descritivos de variáveis e funções
- Funções pequenas e focadas
- Estrutura clara e lógica

❌ **Evite:**
```javascript
// Pega os gastos do mês
const gastos = await getGastos();
```

✅ **Prefira:**
```javascript
const gastosDoMes = await getGastosByMonth(month, year);
```

**Quando comentários são aceitáveis:**
- Documentação de API pública (JSDoc)
- Explicação de algoritmos complexos inevitáveis
- Workarounds temporários com TODO
- Avisos de segurança críticos

### 2. Nomes Descritivos

Use nomes que revelam intenção:

❌ **Ruim:**
```javascript
const d = new Date();
const arr = getData();
function proc(x) { ... }
```

✅ **Bom:**
```javascript
const dataAtual = new Date();
const gastosDoMes = getGastosByMonth();
function processarPagamento(transacao) { ... }
```

### 3. Funções Pequenas

- Uma função = uma responsabilidade
- Máximo ~20 linhas
- Parâmetros claros
- Nome explica o que faz

❌ **Ruim:**
```javascript
function handleRequest(req, res) {
  // valida
  // processa
  // salva no banco
  // envia email
  // retorna resposta
  // 100 linhas depois...
}
```

✅ **Bom:**
```javascript
async function handleRequest(req, res) {
  const data = validateRequest(req);
  const result = await processData(data);
  await saveToDatabase(result);
  await sendNotification(result);
  return formatResponse(result);
}
```

### 4. Evite Números Mágicos

❌ **Ruim:**
```javascript
if (status === 200) { ... }
const timeout = 3600000;
```

✅ **Bom:**
```javascript
const HTTP_OK = 200;
if (status === HTTP_OK) { ... }

const ONE_HOUR_MS = 60 * 60 * 1000;
const timeout = ONE_HOUR_MS;
```

### 5. Tratamento de Erros

Sempre trate erros de forma explícita:

✅ **Bom:**
```javascript
try {
  await processPayment(data);
} catch (error) {
  console.error('Erro ao processar pagamento:', error);
  return res.status(500).send('Erro ao processar pagamento');
}
```

### 6. DRY (Don't Repeat Yourself)

Se você está copiando código, extraia para uma função.

### 7. Consistência

- Use o mesmo padrão em todo o projeto
- Siga convenções da linguagem
- Mantenha formatação uniforme

## Padrões Específicos deste Projeto

### Controllers
- Validação no início da função
- Queries SQL em arquivos separados
- Tratamento de erro com try-catch
- Mensagens de erro descritivas

### SQL
- Use prepared statements ($1, $2)
- IF NOT EXISTS em migrations
- Índices para colunas usadas em WHERE/JOIN
- Nomes em snake_case

### Views (EJS)
- Bootstrap 5 para styling
- Helpers globais: money(), currency()
- Include do header: `<%- include('../partials/header.ejs') %>`

## Checklist de Code Review

- ✅ Sem comentários desnecessários
- ✅ Nomes descritivos
- ✅ Funções pequenas e focadas
- ✅ Tratamento de erros adequado
- ✅ Sem código duplicado
- ✅ Sem números mágicos
- ✅ Consistente com o resto do código
- ✅ Seguro (sem SQL injection, XSS, etc)
