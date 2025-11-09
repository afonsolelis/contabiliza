# Conventional Commit

Crie um commit seguindo o padrão Conventional Commits.

## Instruções

1. Execute `git status` e `git diff` para ver as mudanças
2. Analise todas as mudanças staged e unstaged
3. Verifique os commits recentes com `git log --oneline -5` para manter consistência no estilo
4. Faça `git add` dos arquivos relevantes
5. Crie um commit com mensagem no formato Conventional Commits:

**Formato:**
```
<type>(<scope>): <subject>

<body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types permitidos:**
- `feat`: nova funcionalidade
- `fix`: correção de bug
- `docs`: documentação
- `style`: formatação, ponto e vírgula, etc
- `refactor`: refatoração de código
- `perf`: melhorias de performance
- `test`: adição ou correção de testes
- `chore`: tarefas de manutenção, build, etc

**Regras:**
- Subject: máximo 50 caracteres, imperativo, sem ponto final
- Body: explicação detalhada do "por quê" (não do "o quê")
- Use HEREDOC para a mensagem: `git commit -m "$(cat <<'EOF' ... EOF)"`
- Sempre adicione a assinatura do Claude Code ao final

**Exemplo:**
```bash
git commit -m "$(cat <<'EOF'
feat(api): add user authentication endpoint

- Implement JWT token generation
- Add password hashing with bcrypt
- Create login and logout routes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Importante
- NÃO faça commit de arquivos que contenham credenciais (.env, etc)
- SEMPRE verifique o que está sendo commitado antes
- Se houver pre-commit hooks que modifiquem arquivos, verifique se é seguro fazer amend
