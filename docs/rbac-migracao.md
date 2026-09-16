# Migração: permissões no banco + painel administrativo

Baseado em `permissoes-db-painel-admin-nestjs.md`. Estratégia escolhida:
**aditiva, sem perda de dados** (não usar `prisma migrate reset`).

## Objetivo

- Hoje: `JwtStrategy` deriva `permissions` de `ROLE_PERMISSIONS` (mapa estático em
  `src/auth/permissions/`). Alterar permissão = editar código + deploy.
- Alvo: `Role` e `Permission` viram tabelas; `RolePermission` é a junção N:N.
  ADMIN edita o vínculo pelo painel (`PUT /admin/roles/:id/permissions`) sem deploy.
- Mantém-se o **enum `Permission` em código** como catálogo do que existe
  (`Permission.USER_LIST` etc.); o banco só decide **quem tem**.
- `JwtStrategy` passa a **consultar o banco** a cada request autenticada
  (JWT = identidade; DB = autorização atual).

## Estado atual (ponto de partida)

- `User.role` = `enum Role { USER, MODERATOR, ADMIN }` com `@default(USER)`.
- `schema.prisma` tem um `model Role` órfão + referência a `RolePermissions`
  inexistente → **primeiro passo é limpar isso**.
- JWT payload: `{ sub, email, role }`. `AuthUser`: `{ id, email, role, permissions }`.
- Client gerado desatualizado.

## 1. Schema — models a criar

Remover o `model Role` órfão atual. Manter o `enum Role` **por enquanto** (backfill
depende dele). Adicionar:

```prisma
model Role {
  id          Int              @id @default(autoincrement())
  name        String           @unique          // 'USER' | 'MODERATOR' | 'ADMIN'
  description String?
  users       User[]
  permissions RolePermission[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

model Permission {
  id          Int              @id @default(autoincrement())
  code        String           @unique          // igual aos valores do enum Permission
  description String?
  roles       RolePermission[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

model RolePermission {
  roleId       Int
  permissionId Int
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@id([roleId, permissionId])
}
```

Em `User`, adicionar a relação **sem remover o enum ainda**:

```prisma
model User {
  // ...campos atuais...
  role     Role  @default(USER)   // enum — mantido temporariamente
  roleId   Int?                    // FK nova, nullable no início
  roleRef  Role? @relation(fields: [roleId], references: [id])
}
```

> Colisão de nome: `enum Role` e `model Role` não podem coexistir. Opções:
> (a) renomear o **enum** para `RoleName` durante a transição e removê-lo no fim;
> (b) renomear a relação/coluna. Decidir antes de escrever a 1ª migração. O campo
> `roleRef` acima é placeholder — ajustar conforme a opção escolhida.

## 2. Ordem das migrações (aditiva)

1. **`rbac_tables`**: cria `Role`, `Permission`, `RolePermission`, adiciona
   `User.roleId` **nullable**. Enum `Role`/coluna `User.role` intactos.
2. **Seed** (idempotente, ver §3): insere 3 roles, todas as permissions do enum,
   e o vínculo `RolePermission` a partir do `ROLE_PERMISSIONS` atual.
3. **`backfill_user_role`** (migração SQL manual ou script): `UPDATE "User" SET
   "roleId" = (SELECT id FROM "Role" WHERE name = "User".role::text)`.
4. **`user_role_required`**: torna `User.roleId` `NOT NULL`.
5. Só **depois** que o código novo estiver no ar e estável:
   **`drop_role_enum`** remove `User.role` e `DROP TYPE "Role"`; remover
   `src/auth/permissions/role-permissions.ts` e `get-role-permissions.ts`.

Após cada `migrate dev`: `npx prisma generate`.

## 3. Seed (`prisma/seed.ts`)

Estender o seed atual (mantém `import 'dotenv/config'`, `PrismaPg`, `bcryptjs`,
import relativo `../generated/prisma/client`, padrão `upsert` idempotente):

- `roles`: `[{ name:'USER', description:'Usuário padrão' }, { name:'MODERATOR', ... }, { name:'ADMIN', ... }]` → `prisma.role.upsert({ where: { name } })`.
- `permissions`: derivar de `Object.values(Permission)` (enum em
  `src/auth/enums/permission.enum.ts`) → `prisma.permission.upsert({ where: { code } })`.
  Não redigitar a lista — importar o enum.
- `assignPermissions(roleName, codes[])`: buscar role + permissions por `code in [...]`,
  `prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId, permissionId } } })`.
  Fonte da verdade inicial = `ROLE_PERMISSIONS` (`src/auth/permissions/role-permissions.ts`).
  ⚠️ decidir se ADMIN recebe `COMMENT_DELETE_ANY` (hoje falta no mapa) e adicionar
  `ROLE_PERMISSION_VIEW` / `ROLE_PERMISSION_UPDATE` (permissions novas do painel).
- Usuários fixos atuais (`admin@devconnect.io`, `user@devconnect.io`) passam a setar
  `roleId` via `connect: { name: 'ADMIN' | 'USER' }`.

## 4. Enum `Permission` — adicionar as permissions do painel

Em `src/auth/enums/permission.enum.ts`:
`ROLE_PERMISSION_VIEW = 'ROLE_PERMISSION_VIEW'`, `ROLE_PERMISSION_UPDATE = 'ROLE_PERMISSION_UPDATE'`.

## 5. Mudanças no código de auth

| Arquivo | Mudança |
|---|---|
| `src/auth/interfaces/jwt-payload.interface.ts` | `{ sub, email, roleId: number }` (trocar `role` por `roleId`) |
| `src/auth/auth.service.ts` | `login`/`refreshTokens`: `findByEmail` com `include`/`select` trazendo `roleId`; payload `{ sub, email, roleId }` |
| `src/users/user.service.ts` | `create`: setar role padrão — `role: { connect: { name: 'USER' } }` (ou `roleId` da role 'USER'); lançar `InternalServerErrorException('Role padrão não configurada')` se não existir |
| `src/auth/jwt.strategy.ts` | `validate` passa a `async` com Prisma: `prisma.user.findUnique({ where: { id: payload.sub }, include: { roleRef: { include: { permissions: { include: { permission: true } } } } } })`; monta `AuthUser` com `role: user.roleRef.name` e `permissions: user.roleRef.permissions.map(rp => rp.permission.code)`; `UnauthorizedException` se user não existe. Injetar `PrismaService` (verificar se `AuthModule` importa `PrismaModule`) |
| `src/auth/interfaces/auth-user.interface.ts` | `role: string` (nome da role, não mais enum); `permissions: string[]` ou `Permission[]` |
| `src/auth/guards/roles.guard.ts` | passa a comparar `user.role` (string) — trocar import de `Role` de `generated/prisma/enums` por `string`/enum de nomes |
| `src/auth/permissions/*` | remover `role-permissions.ts` e `get-role-permissions.ts` **só no passo 5 da §2** |

`PermissionsGuard` não muda (continua `every(p => user.permissions.includes(p))`).

Custo: +1 query (com joins) por request autenticada. Evolução futura: cache/Redis
com invalidação ao salvar permissões. **Não** colocar `permissions` no JWT (anula o
objetivo de atualização dinâmica).

## 6. Endpoints administrativos (novos, em `src/admin/`)

`AdminController` já tem `@UseGuards(JwtAuthGuard, PermissionsGuard)` no nível da classe.
Adicionar:

| Método | Rota | `@Permissions` |
|---|---|---|
| GET | `/admin/roles` | `ROLE_PERMISSION_VIEW` |
| GET | `/admin/permissions` | `ROLE_PERMISSION_VIEW` |
| GET | `/admin/roles/:id/permissions` | `ROLE_PERMISSION_VIEW` |
| PUT | `/admin/roles/:id/permissions` | `ROLE_PERMISSION_UPDATE` |

- DTO novo: `src/admin/dto/update-role-permissions.dto.ts` →
  `UpdateRolePermissionsDto { @IsArray @IsInt({ each: true }) permissionIds: number[] }`
  + `@ApiProperty({ example: [1,2,4,7] })`. (Seguir estilo dos DTOs do repo.)
- `AdminService.updateRolePermissions(roleId, permissionIds)`:
  1. `role = prisma.role.findUnique({ where: { id: roleId } })` → 404 `'Role não encontrada'`.
  2. `uniqueIds = [...new Set(permissionIds)]`; `permissions = prisma.permission.findMany({ where: { id: { in } } })`; se `length !==` → `BadRequestException('Uma ou mais permissions são inválidas')`.
  3. **Proteção anti-lockout**: se `role.name === 'ADMIN'` e faltar `ROLE_PERMISSION_VIEW` ou `ROLE_PERMISSION_UPDATE` nos códigos selecionados → `BadRequestException`.
  4. `prisma.$transaction`: `rolePermission.deleteMany({ where: { roleId } })` + `rolePermission.createMany({ data: uniqueIds.map(permissionId => ({ roleId, permissionId })) })`.
  5. retornar `findRolePermissions(roleId)`.
- Swagger: `@ApiOperation` + `@ApiResponse` 200/400/403/404 (padrão do `admin.controller.ts` atual).

## 7. Limpeza final (passo 5 da §2)

- Remover `src/auth/permissions/role-permissions.ts` e `get-role-permissions.ts`.
- Migração `drop_role_enum`: `ALTER TABLE "User" DROP COLUMN "role"; DROP TYPE "Role";`.
- Se o enum foi renomeado para `RoleName` na transição, remover.
- `npx prisma generate` + rodar testes.

## 8. Armadilhas específicas deste repo

- **`npx prisma generate` após toda migração** — client é git-ignored e já está velho.
- **Driver adapter**: qualquer novo `PrismaClient` (ex.: em script) precisa de
  `new PrismaPg({ connectionString: process.env.DATABASE_URL })`; não há `url` no schema.
- **Seed** roda por `npm run db:seed` (`ts-node`), não `prisma db seed`.
- **`Role` importado de 2 lugares** (`src/auth/enums/role.enum.ts` e
  `generated/prisma/enums`) — ao trocar para nome/string, ajustar os dois pontos:
  `roles.guard.ts`, `auth-user.interface.ts`, `jwt-payload.interface.ts`,
  `roles.decorator.ts`, `admin/dto/update-admin.dto.ts` (`@IsEnum(Role)`).
- **`AdminService` e `admin/dto/update-admin.dto.ts`** ainda usam `Role` enum em
  `updateUserRole` — decidir se `USER_CHANGE_ROLE` passa a aceitar `roleId`/`name`.
- **TTL curto do access token** (`30s`): mudança de permissão aparece no próximo
  token; com `JwtStrategy` consultando o banco, aparece já no próximo request.
- **`ApiKeyGuard` global**: todo teste manual precisa do header `x-api-key`.
- **e2e** não resolve aliases — usar imports relativos em `test/`.
- **`PrismaModule` não é global** — `AuthModule` precisa importar `PrismaModule`
  para injetar `PrismaService` em `JwtStrategy` (verificar/adicionar).
- Corrigir o `model Role` órfão **antes** de tudo, senão `migrate dev` nem roda.

## 9. Verificação (matriz de teste)

- `npx prisma validate` sem erro; `npx prisma generate` ok; `npm run build` compila.
- `npm run db:seed` idempotente (rodar 2x, sem duplicar).
- Login ADMIN → `GET /admin/roles` = 200; login USER → 403.
- `GET /admin/roles/:id/permissions` do MODERATOR lista `POST_DELETE_ANY` etc.
- `PUT /admin/roles/:id/permissions` adicionando `USER_LIST` ao MODERATOR →
  MODERATOR chama `GET /admin/users` = 200; remover → 403 (no próximo request,
  sem novo login, porque `JwtStrategy` consulta o banco).
- `permissionIds: [999999]` → 400. `PUT /admin/roles/9999/permissions` → 404.
- Remover `ROLE_PERMISSION_UPDATE` de ADMIN → 400 (anti-lockout).
- Usuário criado por `POST /users` nasce com role `USER` (via seed da role).
