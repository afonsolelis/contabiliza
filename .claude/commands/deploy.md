# Deploy

Faça deploy da aplicação para produção.

## Instruções

1. Verifique se está na branch correta (main)
2. Confirme que todos os testes estão passando
3. Verifique se há mudanças não commitadas: `git status`
4. Revise o último commit: `git log -1`
5. Faça pull para garantir que está atualizado: `git pull`
6. Faça push: `git push`
7. Se usar Railway/Heroku/Vercel, o deploy será automático
8. Monitore os logs para garantir que o deploy foi bem-sucedido

## Checklist de Deploy

- ✅ Código commitado e pushed
- ✅ Testes passando
- ✅ Variáveis de ambiente configuradas
- ✅ Migrations executadas
- ✅ Sem credenciais hardcoded
- ✅ Logs sendo monitorados

## Railway CLI (se necessário)

```bash
railway up
railway logs
```
