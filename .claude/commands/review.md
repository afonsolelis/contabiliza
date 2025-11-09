# Code Review

Faça uma revisão do código antes de commitar.

## Instruções

1. Execute `git diff` para ver todas as mudanças
2. Analise o código quanto a:
   - **Segurança**: SQL injection, XSS, credenciais hardcoded, etc
   - **Bugs**: erros lógicos, edge cases, null checks
   - **Performance**: queries N+1, loops desnecessários, memory leaks
   - **Code style**: consistência, nomenclatura, formatação
   - **Best practices**: DRY, SOLID, separação de responsabilidades
3. Verifique se há:
   - Comentários TODO ou FIXME
   - Console.logs de debug
   - Imports não utilizados
   - Dead code
4. Confirme que testes existentes ainda passam
5. Sugira melhorias se necessário

## Critérios de qualidade

- ✅ Código está seguro (sem vulnerabilidades)
- ✅ Código está testado
- ✅ Código está documentado
- ✅ Código segue os padrões do projeto
- ✅ Código não quebra funcionalidades existentes
