# DevConnect — Contexto para a IA

API NestJS 11 + Prisma 7 + PostgreSQL. Rede social de estudo: usuários, posts,
comentários, reações. Comentários, mensagens de erro e descrições de Swagger em
**português**; identificadores em inglês.

## Comandos

| Ação | Comando | Observações |
|---|---|---|
| Dev | `npm run start:dev` | watch mode; porta `PORT` ou 3000 |
| Build | `npm run build` | `nest build` → `dist/`; prod: `node dist/src/main` |
| Lint | `npm run lint` | ESLint flat config + Prettier (`singleQuote`, `trailingComma: all`) |
| Testes | `npm test` | Jest + ts-jest; specs em `src/**/*.spec.ts` |
| e2e | `npm run test:e2e` | `test/jest-e2e.json` — **sem** moduleNameMapper (usar imports relativos) |
| Prisma client | `npx prisma generate` | **manual** — não há `postinstall` |
| Migração | `npx prisma migrate dev --name <nome>` | CLI lê `prisma7.config.ts` |
| Validar schema | `npx prisma validate` | |
| Seed | `npm run db:seed` | `ts-node prisma/seed.ts` — **não** use `prisma db seed` (não configurado) |

## Prisma 7 — pontos que quebram se ignorados

- Generator **`prisma-client`** (novo, não `prisma-client-js`): gera **TypeScript** em
  `generated/prisma/` (raiz do projeto, fora de `src/`). `moduleFormat = "cjs"`.
- `generated/prisma/` está **no `.gitignore`** → rodar `npx prisma generate` após
  todo clone/install e após toda mudança de schema. O client atual está
  **desatualizado** em relação ao `schema.prisma`.
- `datasource db` no schema **não tem `url`**. A connection string vem de
  `process.env.DATABASE_URL` em runtime:
  - CLI: via `prisma7.config.ts` (`import "dotenv/config"` + `datasource.url`).
  - App: `src/prisma/prisma.service.ts` cria `new PrismaPg({ connectionString: process.env.DATABASE_URL })` (driver adapter obrigatório no Prisma 7).
  - Seed: idem, com `import 'dotenv/config'`.
- Config fica em **`prisma7.config.ts`** (não `prisma.config.ts`). `schema: prisma/schema.prisma`, `migrations.path: prisma/migrations`.
- Import do client: `from 'generated/prisma/client'` (resolvido por `baseUrl: "./"`);
  enums: `from 'generated/prisma/enums'`. No seed é relativo (`../generated/prisma/client`).
- `PrismaModule` **não é `@Global()`** — todo módulo que injeta `PrismaService`
  precisa importar `PrismaModule`.
- Script `contract:emit` (`prisma contract emit`) **não é um comando válido** nesta
  versão — ignore.

## Arquitetura

`src/` — módulos: `auth`, `users`, `posts` (reações vivem aqui, **não há módulo `reactions`**),
`comments` (rota aninhada `posts/:postId/comments`), `admin`, `prisma`, `guard`
(API-key), `common` (pipes + `interceptores/` — grafia PT).

- `AppModule`: `ConfigModule.forRoot({ isGlobal: true })`, guard global
  `APP_GUARD → ApiKeyGuard`. Sem `APP_PIPE`/`APP_INTERCEPTOR`.
- `main.ts`: `ValidationPipe({ whitelist: true, transform: true })` global,
  `LoggingInterceptor` global, Swagger em **`/docs`**.
- **`ApiKeyGuard`** (`src/guard/guard.service.ts`): global; exige header
  **`x-api-key` === `process.env.APIKEY`**; libera `/docs*`; retorna `false` (não lança).
- Registro de usuário é `POST /users` (não há endpoint de registro no `AuthController`).

## Autenticação / Autorização (estado ATUAL)

- Login `POST /auth/login` → `AuthService` assina JWT com payload
  **`{ sub, email, role }`** (`role` = enum, direto da coluna `User.role`).
  Access token TTL padrão `'30s'` (`JWT_EXPIRES_IN`); refresh `'7d'` (`JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN`).
- `JwtAuthGuard` = `AuthGuard('jwt')` puro. `JwtStrategy.validate(payload)`
  **NÃO consulta o banco** — retorna
  `AuthUser = { id: sub, email, role, permissions: getRolePermissions(role) }`.
- `getRolePermissions` lê o mapa **estático** `ROLE_PERMISSIONS`
  (`src/auth/permissions/role-permissions.ts`, `Record<Role, Permission[]>`).
- `RolesGuard`: `requiredRoles.includes(user.role)` (sem hierarquia). Metadata `@Roles(...)`.
- `PermissionsGuard`: `requiredPermissions.every(p => user.permissions.includes(p))`.
  Metadata `@Permissions(...)`. **Não** faz checagem de ownership — `*_OWN` é string comum;
  a posse é verificada no service (`ensureOwner`).
- Guards `Jwt`/`Roles`/`Permissions` são **por rota** via `@UseGuards`; em `AdminController` são no **nível da classe**.
- `@CurrentUser()` (`src/auth/decorators/current-user.decorator.ts`) lê `request.user`;
  aceita `@CurrentUser('id')`.
- Mudança de role só afeta o usuário-alvo após ele pegar novo token (login/refresh).

### `Role` enum — 2 fontes (usadas de forma intercambiável)
`src/auth/enums/role.enum.ts` (manual) **e** `generated/prisma/enums` (`RolesGuard`,
`AuthUser`, `JwtPayload`). Valores: `USER`, `MODERATOR`, `ADMIN`.

### `Permission` enum — só em código: `src/auth/enums/permission.enum.ts`
`POST_CREATE`, `POST_UPDATE_OWN`, `POST_UPDATE_ANY`, `POST_DELETE_OWN`,
`POST_DELETE_ANY`, `COMMENT_CREATE`, `COMMENT_DELETE_OWN`, `COMMENT_DELETE_ANY`,
`COMMENT_UPDATE_OWN`, `REACTION_CREATE`, `REACTION_DELETE_OWN`, `USER_LIST`,
`USER_CHANGE_ROLE`, `USER_VIEW_DETAILS`.

Mapa `ROLE_PERMISSIONS` atual (resumo): `USER` = criar/editar/apagar próprio conteúdo;
`MODERATOR` = USER + `POST_DELETE_ANY` + `COMMENT_DELETE_ANY`; `ADMIN` = tudo de USER +
`POST_DELETE_ANY` + `POST_UPDATE_ANY` + `USER_LIST` + `USER_CHANGE_ROLE` + `USER_VIEW_DETAILS`
(⚠️ hoje ADMIN **não** tem `COMMENT_DELETE_ANY` no mapa).

## Convenções de código

**DTOs** (`<module>/dto/`): 1 classe/arquivo, `create-*.dto.ts` / `update-*.dto.ts`.
`UpdateXDto extends PartialType(CreateXDto)` com `PartialType` de **`@nestjs/swagger`**.
`class-validator` (`@IsString`, `@IsNotEmpty({ message: 'pt' })`, `@IsEmail`, `@IsEnum`),
`@ApiProperty`/`@ApiPropertyOptional`. Campos obrigatórios com `!:`.

**Controllers**: finos (handler = 1 linha delegando ao service). `@ApiTags` na classe;
`@ApiSecurity('api-key')` na classe em auth/posts/comments. Params sempre com
`ParseIntPipe`; `:id` para o recurso próprio, `:postId`/`:commentId` para aninhados.
Usuário via `@CurrentUser() user: AuthUser` → passa `user.id` ao service.
Ordem de decorators é inconsistente no repo — não normalizar sem pedir.

**Services**: `constructor(private readonly prisma: PrismaService) {}`
(import `from 'src/prisma/prisma.service'`). Exceções de `@nestjs/common` com mensagem
PT: `NotFoundException`, `ForbiddenException`, `ConflictException` (Prisma `P2002`),
`UnauthorizedException`. Helpers privados `async` que retornam a linha:
`ensureExists`/`ensurePostExists`, `ensureOwner`, `getScoped` (valida `comment.postId === postId`).
Delete retorna `{ deleted: true }`. Reações: `upsert` com chave composta `userId_postId`.
Objetos de projeção no topo do arquivo como `const ... as const`:
`userSelect` (users/admin — admin inclui `role`), `authorPreview = { select: { id, name } }`
(posts/comments/app). Listas: `orderBy: { createdAt: 'desc' }` (feeds) / `'asc'` (comentários).

**tsconfig**: sem `paths`; `baseUrl: "./"`. `strict` **não** ligado (só `strictNullChecks`);
`noImplicitAny: false`. `target ES2023`, `module commonjs`.

**Testes**: quase todos são só `expect(x).toBeDefined()` com deps stubadas
(`{ provide: PrismaService, useValue: {} }`). `guard.service.spec.ts` é o único com
asserções reais. `auth.controller.spec.ts` e `posts.service.spec.ts` estão **vazios**.
e2e (`test/`) **não** resolve aliases `src/*` nem `generated/*` — usar imports relativos.

## Bugs / pendências conhecidas (NÃO corrigidos ainda)

1. **`prisma/schema.prisma` não valida**: coexistem `enum Role` e `model Role`;
   `model Role` referencia `RolePermissions` (inexistente); `User` não tem relação
   com `model Role`. Ver `docs/rbac-migracao.md`.
2. `generated/prisma/` desatualizado vs schema — rodar `npx prisma generate`.
3. `src/comments/comments.controller.ts` `userUpdate`: `@Param('PostId', ...)` (P
   maiúsculo — rota é `postId`) → `ParseIntPipe` lança 400; `postId` nunca é
   passado ao service.
4. `src/comments/comments.service.ts` `ensureOwner(id, userId)` chama
   `ensurePostExists(id)` com o **id do comentário** → busca `Post` pelo id errado,
   compara `post.userId` no lugar de `comment.userId` (falha de autorização) e 404
   enganoso. Typo `'comentátio'`. É quase duplicata de `update`/`getScoped`.
5. `users.controller.ts` PUT/PATCH `/users/:id` só exigem *um* JWT válido — sem
   checar que o token pertence ao `:id`.
6. `AdminController` importa `RolesGuard`/`Roles`/`Role` sem usar; `updateUserRole`
   faz `Number(id)` redundante após `ParseIntPipe`.
7. Migração `20260831124400_align_field_names` adiciona `Post.updatedAt` sem default
   (quebra em tabela não-vazia).

## RBAC no banco — EM ANDAMENTO

Migração de `ROLE_PERMISSIONS` estático → tabelas `Role`/`Permission`/`RolePermission`
com painel admin. Regra: **o código define quais permissões existem (enum `Permission`);
o banco define quais roles as possuem.** Passo a passo, ordem das migrações,
mudanças em `JwtStrategy`/`AuthService`/`AuthUser`/`JwtPayload` e armadilhas:
ver **`devconnect/docs/rbac-migracao.md`**.
