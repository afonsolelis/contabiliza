# Spec: Conventional Commits

## Objetivo
Padronizar as mensagens de commit do repositório seguindo o padrão Conventional Commits, para tornar o histórico previsível, facilitar revisões e permitir automação de changelogs/releases.

## Formato básico
- `tipo[escopo opcional]!: descrição breve no imperativo`
- Use letras minúsculas; sem ponto final na descrição.
- O `!` indica mudança que exige atenção especial (breaking change).
- Exemplos:
  - `feat(tags): permitir renomear tag existente`
  - `fix(gastos): corrigir cálculo de parcela ao virar o mês`
  - `refactor!: remover suporte a autenticação básica`

## Tipos permitidos
- `feat`: nova funcionalidade voltada ao usuário.
- `fix`: correção de bug.
- `docs`: documentação apenas.
- `style`: ajustes de formatação que não alteram comportamento.
- `refactor`: alteração interna sem mudar funcionalidade nem corrigir bug.
- `perf`: melhora de desempenho.
- `test`: adição ou ajuste de testes.
- `build`: mudanças em build, dependências ou ferramentas.
- `ci`: alterações em pipelines de integração contínua.
- `chore`: tarefas diversas que não se enquadram nos tipos acima.
- `revert`: desfaz um commit anterior (`revert: <assunto revertido>`).

## Corpo e rodapés
- Separe cabeçalho e corpo por uma linha em branco.
- Use o corpo para explicar **o que** mudou e **por quê**; o *como* fica no diff.
- Mantenha o corpo com linhas de até ~72 caracteres para leitura em CLIs.
- Inclua rodapés para metadados quando aplicável:
  - `BREAKING CHANGE: <descrição + instruções de migração>`
  - `Refs: #123`, `Closes: #123`

## Boas práticas
- Agrupe commits por unidade lógica; evite misturar assuntos num único commit.
- Prefira escopos curtos e consistentes com os módulos do projeto (`gastos`, `tags`, `contas`, `dashboard`, `reports`, `db`, `docker`).
- Revise a mensagem antes de commitar — comunicação clara facilita revisões.
- Para breaking changes, descreva no rodapé exatamente como adaptar o código/infra afetados.

## Exemplo completo

```
feat(gastos)!: dividir parcelamento por grupo_id

Agora cada compra parcelada compartilha um parcela_grupo_id (UUID) e
gera uma linha por parcela, com data_efetivacao avançada mês a mês.
Facilita relatórios por compra e permite estornar o grupo inteiro.

BREAKING CHANGE: gastos antigos sem parcela_grupo_id precisam ser
backfilled via script antes de rodar os novos relatórios agregados.
Refs: #42
```
