# Docker Setup

## Desenvolvimento Local

### 1. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` e configure suas credenciais.

### 2. Inicie os containers

```bash
docker-compose up -d
```

### 3. Acesse a aplicação

Abra http://localhost:3000

Credenciais padrão (configure no .env):
- User: admin
- Password: changeme

### 4. Logs

```bash
docker-compose logs -f app
docker-compose logs -f postgres
```

### 5. Parar os containers

```bash
docker-compose down
```

### 6. Parar e remover volumes (cuidado: apaga os dados!)

```bash
docker-compose down -v
```

## Produção

### Build da imagem otimizada

```bash
docker build --target production -t contabiliza:latest .
```

### Executar container

```bash
docker run -d \
  --name contabiliza \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e AUTH_USER="admin" \
  -e AUTH_PASSWORD="senha-segura" \
  contabiliza:latest
```

## Arquitetura Multi-Stage

O Dockerfile usa 3 stages:

1. **deps**: Instala apenas dependências de produção
2. **builder**: Instala todas as dependências e prepara código
3. **production**: Imagem final mínima com:
   - Node.js 20 Alpine (imagem base pequena)
   - Apenas arquivos necessários
   - Non-root user (nodejs)
   - Health checks configurados
   - ~150MB final

## Otimizações Aplicadas

- ✅ Multi-stage build (reduz tamanho em ~70%)
- ✅ Alpine Linux (imagem base mínima)
- ✅ Non-root user (segurança)
- ✅ .dockerignore (exclui arquivos desnecessários)
- ✅ Layer caching (package.json copiado primeiro)
- ✅ npm cache clean (reduz tamanho)
- ✅ Health checks (resiliência)
- ✅ Restart policies (alta disponibilidade)

## Comandos Úteis

```bash
# Rebuild sem cache
docker-compose build --no-cache

# Ver tamanho das imagens
docker images | grep contabiliza

# Acessar shell do container
docker-compose exec app sh

# Acessar PostgreSQL
docker-compose exec postgres psql -U postgres -d contabiliza

# Ver estatísticas de recursos
docker stats contabiliza-app contabiliza-db
```
