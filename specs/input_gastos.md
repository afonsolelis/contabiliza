# Spec: Input de Gastos via Chat

## Objetivo
Quando o usuário informar gastos no chat, o assistente deve coletar as informações necessárias e inserir no banco PostgreSQL usando `psql` e a `DATABASE_URL` do `.env`.

## Conexão
- **OBRIGATÓRIO:** Antes de qualquer query, sempre carregar o `.env` com `source .env` para obter a `DATABASE_URL` atualizada
- Executar queries via: `source /caminho/do/projeto/.env && psql "$DATABASE_URL" -c "SQL"`
- Nunca assumir que a variável `DATABASE_URL` já está definida no ambiente — sempre fazer `source .env` no mesmo comando

## Dados existentes no banco

### Contas disponíveis (tabela `contas`)
| id | banco        | agencia | conta     |
|----|--------------|---------|-----------|
| 1  | Nubank       | 0001    | 9578276-6 |
| 2  | Mercado Pago | 0000    | 0000      |
| 3  | BTG          | 20      | 480302-8  |

### Tags disponíveis (tabela `tags`)
enel, envios_pix, estapar, sem_parar, pokemon_tcg, dona_jo, cond_marta, cond_porto_dover, vivo, vida_nubank, comgas, repasse_cat, rewards, alimentacao, casa, uber, carro, google_play, animais, farmacia, loterica, web_cloud_ia, mercado, roupas, nazira, uni_italo, ether_tcg, games, total_pass, emprestimo_nubank

### Tipos de gasto
- `pix`
- `debito`
- `cartao`

## Fluxo de coleta de informações

Quando o usuário quiser registrar um gasto, coletar (perguntar o que faltar):

1. **Descrição** (`descricao_gasto`, text, obrigatório) — o que foi o gasto
2. **Valor** (`valor`, numeric, obrigatório) — em reais (ex: 150.00)
3. **Tipo** (`tipo`, text, obrigatório) — `pix`, `debito` ou `cartao`
4. **Conta** (`conta_id`, integer, opcional) — qual banco (Nubank=1, Mercado Pago=2, BTG=3)
5. **Tag** (`tag_id`, integer, opcional) — categoria do gasto. Se a tag não existir, criar uma nova na tabela `tags`
6. **Data de efetivação** (`data_efetivacao`, timestamptz, obrigatório) — quando o gasto foi feito. Se não informada, usar a data atual
7. **Parcelamento** (opcional):
   - `parcela_numero` — número da parcela atual
   - `parcela_total` — total de parcelas
   - `parcela_grupo_id` — UUID gerado automaticamente para agrupar parcelas da mesma compra

## Regras de parcelamento

- Se o gasto for parcelado, gerar um `uuid` único para `parcela_grupo_id`
- Criar **uma linha para cada parcela**, incrementando `parcela_numero` de 1 até `parcela_total`
- O `valor` de cada parcela é o **valor total dividido pelo número de parcelas**
- A `data_efetivacao` de cada parcela é incrementada em 1 mês a partir da data da primeira parcela
- A `descricao_gasto` de cada parcela recebe o sufixo ` (parcela X/Y)`

## Verificação de duplicatas (OBRIGATÓRIO)

Antes de qualquer INSERT, o assistente DEVE executar uma query de verificação para identificar gastos possivelmente duplicados. A busca considera:

1. **Descrição similar** — usar `ILIKE` com termos-chave da descrição
2. **Valor exato** — deve ser idêntico ao informado
3. **Data próxima** — dentro de ±3 dias da data informada
4. **Parcelamento** — se for parcelado, verificar se já existe um `parcela_grupo_id` com a mesma descrição base e mesmo `parcela_total`

### Query de verificação

```sql
SELECT id, descricao_gasto, valor, data_efetivacao, tipo, conta_id, parcela_numero, parcela_total
FROM gastos
WHERE (
  descricao_gasto ILIKE '%termo_chave%'
  OR (valor = valor_informado
      AND data_efetivacao BETWEEN 'data_informada'::date - INTERVAL '3 days'
                              AND 'data_informada'::date + INTERVAL '3 days')
)
ORDER BY data_efetivacao DESC
LIMIT 10;
```

### Comportamento ao encontrar possíveis duplicatas

- **Se encontrar registros similares:** mostrar ao usuário os gastos encontrados e perguntar se o novo gasto é realmente diferente ou se é duplicata
- **Se não encontrar nada:** seguir o fluxo normal de confirmação e INSERT
- **Se for parcelado:** verificar especificamente se já existem parcelas com mesma descrição base e mesmo `parcela_total`, para evitar recadastrar parcelas já lançadas

### Exemplo de interação com duplicata detectada

**Usuário:** gastei 182 reais no mcdonalds ontem no nubank
**Assistente:** Encontrei um gasto parecido já cadastrado:
| ID  | Descrição             | Valor    | Data       |
|-----|-----------------------|----------|------------|
| 932 | McDonald's com alunos | R$182,50 | 2026-04-07 |

Esse gasto é o mesmo ou é um novo? Se for novo, confirmo o cadastro.

## Regras gerais

- O assistente deve tentar inferir o máximo possível a partir do texto do usuário
- Se o usuário passar múltiplos gastos de uma vez, processar todos
- **Sempre verificar duplicatas antes de inserir** (ver seção acima)
- Confirmar com o usuário antes de executar o INSERT, mostrando um resumo
- Após inserir, mostrar o resultado com o id gerado

## Exemplo de INSERT

```sql
-- Gasto simples
INSERT INTO gastos (descricao_gasto, valor, tag_id, tipo, conta_id, data_efetivacao)
VALUES ('Almoço restaurante', 45.90, 14, 'cartao', 1, '2026-04-08')
RETURNING id, descricao_gasto, valor;

-- Gasto parcelado (3x)
INSERT INTO gastos (descricao_gasto, valor, tag_id, tipo, conta_id, data_efetivacao, parcela_numero, parcela_total, parcela_grupo_id)
VALUES
  ('Tênis Nike (parcela 1/3)', 100.00, 26, 'cartao', 1, '2026-04-08', 1, 3, 'a1b2c3d4-...'),
  ('Tênis Nike (parcela 2/3)', 100.00, 26, 'cartao', 1, '2026-05-08', 2, 3, 'a1b2c3d4-...'),
  ('Tênis Nike (parcela 3/3)', 100.00, 26, 'cartao', 1, '2026-06-08', 3, 3, 'a1b2c3d4-...')
RETURNING id, descricao_gasto, valor, data_efetivacao;
```

## Exemplo de interação

**Usuário:** gastei 45 reais no almoço hoje no nubank cartão
**Assistente:** Entendi! Vou registrar:
- Descrição: Almoço
- Valor: R$ 45,00
- Tipo: cartao
- Conta: Nubank (id 1)
- Tag: alimentacao (id 14)
- Data: 2026-04-08
- Parcelado: Não

Confirma? (sim/não)

**Usuário:** sim
**Assistente:** *executa o INSERT e retorna o id*
