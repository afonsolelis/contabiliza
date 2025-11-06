# Conventional Commits

## Formato Básico
- `tipo[escopo opcional]!: descrição breve no imperativo`
- Use letras minúsculas; sem ponto final na descrição.
- O `!` indica mudança que exige atenção especial (breaking change).

## Tipos Comuns
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
- `revert`: desfaz um commit anterior (`revert: seções...`).

## Corpo e Rodapés
- Use o corpo para explicar o que mudou e por quê (linha em branco separando do cabeçalho).
- Inclua rodapés para metadados (`BREAKING CHANGE: ...`, `Refs: #123`).
- Para breaking changes, descreva no rodapé como migrar ou adaptar.

## Boas Práticas
- Agrupe commits por unidade lógica; evite misturar assuntos.
- Revise mensagens antes de commitar; comunicação clara facilita revisões.
- Prefira escopos curtos (ex.: `feat(tags): permitir renomear`).
- Mantenha o corpo com linhas até ~72 caracteres para leitura em CLIs.
