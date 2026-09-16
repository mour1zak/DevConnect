# Contexto para IA — Desafio: Evoluir o DevConnect de memória para Prisma + PostgreSQL

> **Como usar este documento**: cole isto como a **primeira mensagem** de uma conversa nova com a IA (ou anexe o arquivo). A partir daqui, a IA tem o contexto do desafio e do **estado real** do meu projeto NestJS chamado **DevConnect**.
>
> **Meu papel:** eu implemento o código **à mão**. **Papel da IA:** tutor/revisor —
> 1. explicar os conceitos com analogias, antes de eu codar;
> 2. me fazer perguntas quando eu propuser uma solução, em vez de já entregar a resposta;
> 3. revisar o código que eu escrever, apontar erros e dizer o que está faltando;
> 4. conferir cada etapa contra os "critérios de saída" / matriz de testes no fim deste documento.
>
> **Não escreva os arquivos inteiros por mim** — só um exemplo pontual quando eu pedir explicitamente. O objetivo é praticar, não copiar.
>
> **Fonte de verdade:** o código-fonte em `devconnect/src/` + `devconnect/prisma/` + `devconnect/package.json`, e o relatório técnico `devconnect/docs/RELATORIO-DEVCONNECT.md` (esse está atualizado). **Ignore** `README.md` e `RELATORIO-CONTEXTO-IA.md` — estão parcialmente desatualizados (descrevem uma fase anterior sem Prisma; o typo `JWR_EXPIRES_IN` no `.env` já foi corrigido; os Pipes e o Interceptor já existem).

---

## 1. O desafio (resumo)

Evoluir a arquitetura, **sem mudar o comportamento da API e sem adicionar features novas**:

```
ANTES                          DEPOIS
Controller                     Controller
   ↓                              ↓
Service                        Service
   ↓                              ↓
Array em memória               Prisma Client
   ↓                              ↓
(RAM, some no restart)         PostgreSQL (persiste)
```

Ao final, o DevConnect deve:

- persistir **User, Post, Comment, Reaction** em PostgreSQL;
- manter **login com JWT**, proteção com **API Key**, identificação do usuário **pelo JWT** (não pelo Body);
- garantir **propriedade dos recursos** (só o dono altera/exclui) → `403`;
- usar **relacionamentos do Prisma** (`include` / `select`);
- **continuar funcionando após reiniciar** a aplicação.

**Fora de escopo agora:** Swagger, RBAC, Roles, Profiles, upload com Multer, interceptors avançados, HttpService, Helmet, compression.

### Entidades e relacionamentos

```
User  ──1:N──> Post        Post ──N:1──> User
User  ──1:N──> Comment     Comment ──N:1──> User  +  Comment ──N:1──> Post
User  ──1:N──> Reaction    Reaction ──N:1──> User  +  Reaction ──N:1──> Post
```

- `Post` tem `userId` → identifica **quem publicou**.
- `Comment` tem `userId` **e** `postId` → identifica **quem comentou** e **em qual post**.
- `Reaction` tem `userId` **e** `postId`, com `@@unique([userId, postId])` → **uma reação por usuário por post**.

---

## 2. Estado real do DevConnect hoje

> **Resumo de uma linha:** a infraestrutura Prisma + Postgres **já está montada e funcionando**; Posts e Comments **já são 100% Prisma**. O que falta é sobretudo **Users** (ainda em memória), **login lendo o array**, **`userId` vindo do Body**, **não existe `@CurrentUser()`** e **não há nenhuma checagem de propriedade (403)**.

### Stack (do `package.json`)

NestJS 11 · `@nestjs/config` · `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` · **Prisma 7 + `@prisma/adapter-pg` + `pg`** · `bcryptjs` · `class-validator` / `class-transformer` · TypeScript 5.7 · Jest 30.

### Estrutura de `src/`

```text
src/
├── main.ts                         # ValidationPipe global + LoggingInterceptor global
├── app.module.ts                   # ConfigModule.forRoot({ isGlobal:true }) + os 6 módulos
├── auth/
│   ├── auth.module.ts              # JwtModule.registerAsync + PassportModule
│   ├── auth.controller.ts          # POST /auth/login, POST /auth/refresh, GET /auth/profile
│   ├── auth.service.ts             # validateUser / login / refreshTokens / generateTokens
│   ├── jwt.strategy.ts             # PassportStrategy(Strategy) → validate() devolve { id, email }
│   ├── jwt-auth.guard.ts           # class JwtAuthGuard extends AuthGuard('jwt')
│   ├── dto/                        # login.dto.ts, refresh-token.dto.ts
│   └── interfaces/                 # auth-user.interfaces.ts (AuthUser), jwt.payload.interface.ts  ← ambos SEM USO
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts         # POST e PUT protegidos por (ApiKeyGuard, JwtAuthGuard); resto público
│   ├── user.service.ts             # ⚠️ AINDA EM MEMÓRIA (array `users`), exceto validateEmail()
│   ├── dto/                        # create-user, update-user (PartialType), replace-user
│   └── entities/user.entity.ts     # class desatualizada (id, name, email, password — sem bio/relations)
├── posts/
│   ├── posts.module.ts
│   ├── posts.controller.ts         # ⚠️ NENHUM Guard em nenhuma rota
│   ├── posts.service.ts            # ✅ 100% Prisma (inclui reaction.upsert)
│   ├── dto/                        # create-post (tem userId!), update-post, create-reaction (tem userId!)
│   └── entities/post.entity.ts     # stub vazio
├── comments/
│   ├── comments.module.ts
│   ├── comments.controller.ts      # ⚠️ NENHUM Guard; rota é /comments/:postId e /comments/:id
│   ├── comments.service.ts         # ✅ 100% Prisma
│   ├── dto/                        # create-comment (tem userId!), update-comment
│   └── entities/comment.entity.ts  # stub vazio
├── guard/
│   ├── guard.module.ts             # provê/exporta ApiKeyGuard
│   └── guard.service.ts            # class ApiKeyGuard (nome do arquivo é "service", mas é um Guard)
├── common/
│   ├── pipes/not-blank.pipe.ts     # NotBlankPipe — rejeita string só-espaços
│   ├── pipes/name-validation.pipe.ts # NameValidationPipe — rejeita dígitos
│   └── interceptores/logging.interceptor.ts # LoggingInterceptor global
└── prisma/
    ├── prisma.module.ts            # providers: [PrismaService], exports: [PrismaService]
    └── prisma.service.ts           # extends PrismaClient via PrismaPg adapter + DATABASE_URL
```

### O que JÁ está pronto (mapeado às etapas do desafio)

| Etapa do desafio | Status | Onde / detalhe |
|---|---|---|
| **1 — PostgreSQL** | ✅ | `.env`: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/devconnect?schema=public"`, `APIKEY=123456`, `JWT_SECRET`, `JWT_EXPIRES_IN="20m"` (+ `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN`). **Não há docker-compose** — o Postgres precisa estar rodando localmente na 5432. |
| **2 — Instalar/configurar Prisma** | ✅ | Prisma 7 instalado e client gerado. `generator client { provider = "prisma-client"; output = "../generated/prisma" }`. O CLI lê a URL via `prisma7.config.ts` (nome não-padrão — comandos podem exigir `--config prisma7.config.ts`). |
| **3 — Criar os Models** | ✅ | `prisma/schema.prisma` tem `User`, `Post`, `Comment`, `Reaction`, `enum ReactionType { LIKE DISLIKE }`, todas as `@relation`, `onDelete: Cascade` em `Comment`→`Post` e `Reaction`→`Post`, e `@@unique([userId, postId])` em `Reaction`. |
| **4 — Migration** | ✅ | 2 migrations aplicadas: `20260825144519_init` (4 tabelas + FKs + enum + índices únicos) e `20260825145744_bio` (`ALTER TABLE "User" ADD COLUMN "bio"`). `migration_lock.toml` → `postgresql`. |
| **5 — PrismaService** | ✅ (variante) | `PrismaService extends PrismaClient` usando `new PrismaPg({ connectionString: process.env.DATABASE_URL })`. `PrismaModule` faz `providers` **e** `exports`. **Diferença vs. o exemplo do desafio:** não tem `onModuleInit`/`$connect` — a conexão é *lazy* pelo adapter. Funciona; dá pra adicionar os hooks depois se quiser encerrar conexões no shutdown. |
| **11/16 — Posts e Comments com Prisma** | ✅ | `PostsService` e `CommentsService` são 100% `this.prismaService.post.*` / `.comment.*`. Padrão: `findOne(id)` lança `NotFoundException` se `findUnique` devolve `null`, e é chamado antes de `update`/`delete`. |
| **19 — `upsert` de Reaction** | ✅ | `PostsService.createReaction(postId, dto)` → `await this.findOne(postId)` e depois `prisma.reaction.upsert({ where: { userId_postId: { userId, postId } }, create: {...}, update: { type } })`. Trocar `LIKE`↔`DISLIKE` atualiza a linha existente. |
| **9 — Login (lógica)** | ⚠️ parcial | `AuthService` tem `validateUser` / `login` / `generateTokens`; payload `{ sub: user.id, email: user.email }`; `bcrypt.compare`; `jwtService.signAsync`. `JwtStrategy.validate()` devolve `{ id, email }` → vira `req.user`. **Mas** `validateUser` busca o usuário no **array em memória** (ver §3). |
| **22 — API Key** | ✅ (aplicação parcial) | `ApiKeyGuard.canActivate` lê `x-api-key` e compara com `process.env.APIKEY`; retorna `false` (→ 403) se faltar/errar. Hoje aplicado **só** em `POST /users` e `PUT /users/:id` (junto com `JwtAuthGuard`). |
| Validação de entrada | ✅ | `ValidationPipe({ whitelist: true, transform: true })` global no `main.ts` + DTOs `class-validator` em todos os módulos. `ParseIntPipe` nos `:id` da URL. |

### `prisma/schema.prisma` (atual, íntegra)

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

enum ReactionType {
  LIKE
  DISLIKE
}

model User {
  id        Int        @id @default(autoincrement())
  name      String
  email     String     @unique
  password  String
  bio       String?
  posts     Post[]
  comments  Comment[]
  reactions Reaction[]
  createdAt DateTime   @default(now())
}

model Post {
  id        Int        @id @default(autoincrement())
  text      String
  userId    Int
  user      User       @relation(fields: [userId], references: [id])
  comments  Comment[]
  reactions Reaction[]
  createdAt DateTime   @default(now())
  updateAt  DateTime   @updatedAt        // ← "updateAt" (falta o "d") — vira essa propriedade no client
}

model Comment {
  id        Int      @id @default(autoincrement())
  text      String
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  postId    Int
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  CreatedAt DateTime @default(now())      // ← "CreatedAt" com C maiúsculo
}

model Reaction {
  id     Int          @id @default(autoincrement())
  type   ReactionType
  userId Int
  user   User         @relation(fields: [userId], references: [id])
  postId Int
  post   Post         @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@unique([userId, postId])
}
```

> Detalhes que valem discussão com a IA: `Post.updateAt` (sem "d") e `Comment.CreatedAt` (C maiúsculo) — funcionam, mas destoam do resto. `bio` é `String?` (opcional) — o enunciado mostra `bio String` obrigatório; foi uma decisão consciente do projeto, não um erro. Renomear qualquer campo desses exige **nova migration**.

---

## 3. O que ainda falta (o foco do trabalho manual)

Em ordem de prioridade. Cada item = uma conversa com o tutor: **primeiro o conceito, depois eu codo, depois a revisão.**

### 3.1 — `UsersService` ainda vive num array em memória — **maior lacuna**

`src/users/user.service.ts` hoje:

```ts
@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}   // injeta Prisma...

  private readonly users: User[] = [                              // ...mas guarda tudo aqui
    { id: 1, name: 'Ana',    email: 'ana@devconnect.com',    password: bcrypt.hashSync('123456', 10) },
    { id: 2, name: 'Carlos', email: 'carlos@devconnect.com', password: bcrypt.hashSync('123456', 10) },
  ];
  private nextId = this.users.length + 1;

  async create(dto)      { /* this.users.push(...) */ }
  async validateEmail(e) { return this.prismaService.user.findFirst({ where: { email: e } }); }  // ← único método que usa Prisma
  findAll()              { return this.users.map(({ password, ...r }) => r); }
  findOne(id)            { /* this.users.find(...) + NotFoundException */ }
  findByEmail(email)     { return this.users.find(u => u.email === email); }   // usado pelo AuthService
  findByName(name)       { /* this.users.filter(...) */ }
  update(id, dto)        { /* Object.assign no objeto do array */ }
  remove(id)             { /* this.users.splice(...) */ }
}
```

**A fazer (Etapas 6, 7, 8, 10):**
- `create` → `this.prismaService.user.create({ data: {...}, select: { id, name, email, bio, createdAt } })` — sem devolver `password`. Não enviar `id` nem `createdAt` (gerados pelo banco).
- `findAll` → `this.prismaService.user.findMany({ select: { ... } })` — `password` **fora** do `select`.
- `findOne` → `this.prismaService.user.findUnique({ where: { id } })`; se `null` → `NotFoundException` (`findUnique` **não** lança sozinho).
- `findByEmail` → `findUnique({ where: { email } })` (agora precisa do `password` para o login comparar — decidir com o tutor se esse método devolve o registro completo e os *outros* usam `select`).
- `findByName` → `findMany({ where: { name: { contains: name, mode: 'insensitive' } }, select: {...} })`.
- `update` / `remove` → `user.update` / `user.delete`. `update`/`delete` **lançam `P2025`** se o id não existe → tratar (chamar `findOne` antes, ou `try/catch`).
- Remover o array `users` e o `nextId` por completo.

### 3.2 — Login e refresh ainda leem o array em memória (Etapas 9, 10)

`src/auth/auth.service.ts`:

```ts
async validateUser(email, password) {
  const user = this.usersService.findByEmail(email);   // ← array em memória, e SEM await
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password);
  ...
}
// refreshTokens() também chama this.usersService.findByEmail(payload.email)
```

**A fazer:** apontar `findByEmail` (ou o `AuthService`) para `prisma.user.findUnique({ where: { email } })`, e colocar o `await` que falta aqui e no `refreshTokens`. O restante (payload, `signAsync`, `UnauthorizedException('Credenciais inválidas')`) **não muda** — só muda a origem do usuário. Depois: **Teste A** (§5) — cadastrar, reiniciar, logar de novo.

### 3.3 — `userId` está vindo do Body (Etapas 12, 16, 18, 24)

```ts
// create-post.dto.ts
export class CreatePostDto { text!: string;  userId!: number; }   // ← userId NÃO deveria estar aqui
// create-comment.dto.ts   → também tem userId!
// create-reaction.dto.ts  → também tem userId!
```

**A fazer:** remover `userId` dos três DTOs. O autor deve vir de:

```
JWT → JwtStrategy.validate() → request.user → @CurrentUser() → user.id
```

Assinatura-alvo dos services: `create(userId: number, dto)`, `createReaction(userId: number, postId: number, dto)`, `createComment(userId: number, postId: number, dto)`.

### 3.4 — Não existe `@CurrentUser()` (Etapa 12)

A interface já existe, sem uso: `src/auth/interfaces/auth-user.interfaces.ts` → `interface AuthUser { id: number; email: string }`. Hoje só `GET /auth/profile` lê o usuário, via `@Request() req` cru.

**A fazer:** criar um `createParamDecorator` (ex.: `src/auth/decorators/current-user.decorator.ts`) que devolve `request.user` tipado como `AuthUser`. Usar `@CurrentUser() user: AuthUser` nos controllers protegidos.

### 3.5 — Rotas de Posts / Comments / Reactions sem Guard nenhum (Etapas 12, 22, 24)

`PostsController` e `CommentsController` não têm **nenhum** `@UseGuards`. Qualquer um cria/edita/apaga.

**A fazer:** `@UseGuards(JwtAuthGuard)` nas rotas de escrita (POST/PUT/PATCH/DELETE) de posts, comentários e reações. Onde a API Key também fizer sentido: `@UseGuards(ApiKeyGuard, JwtAuthGuard)` (ordem importa — a API Key barra primeiro). Decidir com o tutor se `GET` continua público.

### 3.6 — Nenhuma checagem de propriedade / `403` (Etapas 14, 15, 17, 25)

Não existe **nenhum** `ForbiddenException` no projeto. `PUT/DELETE /posts/:id`, delete de comentário e delete de reação não conferem dono.

**Fluxo-alvo** (para Post; análogo para Comment):

```
1. buscar o Post por id  → não existe? 404
2. post.userId === currentUser.id ?  → não? 403
3. só então  prisma.post.update(...) / prisma.post.delete(...)
```

### 3.7 — Comentário: rota aninhada e 4 validações (Etapas 16, 17)

Hoje: `POST /comments/:postId` e `DELETE /comments/:id`. O desafio pede:

- `POST /posts/:postId/comments` — combinar `postId` (URL) + `userId` (JWT) + `text` (Body); validar que o Post existe antes de criar.
- `DELETE /posts/:postId/comments/:commentId` — validar, nesta ordem: **Post existe? Comment existe? Comment pertence ao Post? Comment pertence ao usuário autenticado?** → `404` / `404` / `404`(ou 400) / `403` / `204`.

Decidir com o tutor: renomear as rotas para o formato aninhado, ou manter as atuais e só adicionar as validações.

### 3.8 — Reações: rota no plural e `DELETE` inexistente (Etapas 18, 20)

Hoje: `POST /posts/:postId/reaction` (singular), **sem** `DELETE`. O desafio pede:

- `POST /posts/:postId/reactions` — `type` no Body; `userId` do JWT; `postId` da URL; `upsert` (já implementado, só falta o `userId` sair do Body).
- `DELETE /posts/:postId/reactions` — sem `reactionId` nem `userId` no Body; localizar por `where: { userId_postId: { userId: currentUser.id, postId } }` e apagar.

### 3.9 — `include` / `select` nos relacionamentos (Etapas 13, 21)

Hoje: `PostsService.findAll` = `findMany()` puro; `findOne` = `findUnique({ include: { comments: true } })` (sem `user`, sem `reactions`, e `comments` sem o autor).

**Alvo de `GET /posts/:id`:**

```jsonc
{
  "id": 10, "text": "...",
  "user":      { "id": 1, "name": "Ana" },
  "comments":  [ { "id": 3, "text": "...", "user": { "id": 2, "name": "Carlos" } } ],
  "reactions": [ { "type": "LIKE", "user": { "id": 2, "name": "Carlos" } } ]
}
```

Usar `select` aninhado para **nunca** deixar `password` aparecer em nenhum nível. `findAll` deve incluir ao menos o autor.

### 3.10 — Erro de e-mail duplicado → HTTP correto (Bônus 5)

`UsersController.create` hoje:

```ts
const existUser = this.usersService.validateEmail(createUserDto.email);   // sem await → Promise (sempre truthy)
if (!existUser) throw new UnauthorizedException('Emaill já cadastrado');   // lógica invertida + status errado
```

**A fazer:** depois que `create` for pra Prisma, a constraint `@unique(email)` lança **`P2002`**. Capturar e devolver **`409 Conflict`** (`ConflictException`) com mensagem limpa — **sem** vazar o objeto de erro do Prisma. Corrigir o `await` e a inversão de qualquer jeito.

### 3.11 — Persistência de `User` após restart (Teste A, Etapa 23)

Hoje **falha**: usuários criados somem no restart (estão no array). Passa a valer automaticamente depois do §3.1 + §3.2.

### 3.12 — Opcionais / polimento

- Schema: `updateAt`→`updatedAt`, `CreatedAt`→`createdAt` (exige migration nova).
- `PrismaService`: adicionar `implements OnModuleInit` + `async onModuleInit() { await this.$connect(); }` e `enableShutdownHooks`, como no exemplo da Etapa 5.
- `src/users/entities/user.entity.ts` e os stubs `post.entity.ts` / `comment.entity.ts`: decidir se apaga (o tipo real vem do client gerado) ou atualiza.
- `src/guard/guard.service.spec.ts` referencia uma classe `GuardService` que não existe — spec quebrado.

### 3.13 — Bônus (Etapas "Desafio bônus")

- `GET /users/:userId/posts` — resolver partindo de `Post` (`findMany({ where: { userId } })`) e depois partindo de `User` (`findUnique({ where: { id }, include: { posts: true } })`).
- `GET /feed` — `orderBy: { createdAt: 'desc' }` + `include: { user: {select}, _count: { select: { comments: true, reactions: true } } }`.
- `GET /stats` — `prisma.user.count()`, `prisma.post.count()`, etc.
- Cascade: criar Post com comentários e reações, apagar o Post, conferir no banco que `Comment` e `Reaction` sumiram junto (`onDelete: Cascade`), mas o `User` continua.

---

## 4. Roteiro sugerido (ordem de execução)

1. **`UsersService` → Prisma** com `select` sem `password` (§3.1).
2. **Login/refresh → Prisma**; provar restart (Teste A) (§3.2).
3. **`@CurrentUser()`** + **remover `userId` dos DTOs** (§3.3, §3.4).
4. **`JwtAuthGuard`** nas rotas de escrita de Posts/Comments/Reactions (§3.5).
5. **Checagens de propriedade → `403`** em update/delete de Post, delete de Comment, delete de Reaction (§3.6).
6. **`DELETE` de reação** + **rotas aninhadas de comentário** com as 4 validações (§3.7, §3.8).
7. **`include`/`select` ricos** em `GET /posts/:id` e `GET /posts` (§3.9).
8. **`P2002` → `409`** no cadastro (§3.10).
9. **Bônus** (§3.13).

---

## 5. Matriz de testes (Etapas 23–26) — e o que já passa hoje

| Cenário | Esperado | Hoje |
|---|---|---|
| Criar usuário | sucesso + persistido | ⚠️ cria, mas **em memória** — some no restart (falta §3.1) |
| Reiniciar a aplicação | dados de User permanecem | ❌ falha até §3.1 + §3.2. **Post/Comment/Reaction já persistem** ✅ |
| Login válido | `access_token` (+ `refresh_token`) | ⚠️ funciona só p/ Ana/Carlos e usuários criados na mesma execução (falta §3.2) |
| Login inválido | `401 Credenciais inválidas` | ✅ |
| API Key ausente / incorreta | acesso negado (`403`) | ✅ nas rotas que usam `ApiKeyGuard` (hoje só `POST`/`PUT /users`) |
| Rota JWT sem token | `401` | ✅ onde há `JwtAuthGuard` (`/auth/profile`, `POST`/`PUT /users`) — falta aplicar em Posts/Comments (§3.5) |
| JWT inválido / expirado | `401` | ✅ (`ignoreExpiration: false` na strategy) |
| Criar Post autenticado | sucesso, autor = usuário do token | ❌ hoje não exige token e o autor vem do Body (§3.3, §3.5) |
| `userId` enviado no Body | **não** deve determinar o autor | ❌ hoje determina (§3.3) |
| Alterar/Excluir **próprio** Post | sucesso | ⚠️ funciona, mas sem verificar dono |
| Alterar/Excluir Post **de outro** | `403` | ❌ não existe checagem (§3.6) |
| Comentar | sucesso (`postId` da URL, `userId` do JWT) | ⚠️ cria via Prisma, mas `userId` vem do Body e rota não é aninhada (§3.3, §3.7) |
| Excluir comentário **próprio** / **de outro** | sucesso / `403` | ❌ sem checagem de dono nem de vínculo com o Post (§3.7) |
| Criar `LIKE` → trocar por `DISLIKE` | **atualiza** a reação (não duplica) | ✅ `upsert` já faz isso (falta só o `userId` sair do Body) |
| Excluir reação | por `userId` (JWT) + `postId` (URL) | ❌ endpoint não existe (§3.8) |
| Reiniciar no fim | todos os dados continuam | ⚠️ ok para Post/Comment/Reaction; User depende de §3.1 |

---

## 6. Perguntas que eu preciso saber responder (com resposta-referência p/ o tutor conferir)

| Pergunta | Resposta curta de referência |
|---|---|
| Por que os dados em memória desapareciam? | Um array JS vive no processo Node; ao reiniciar, o processo recria tudo do zero. Nada foi gravado fora da RAM. |
| O que o Prisma faz? | ORM: gera um client tipado a partir do `schema.prisma`, traduz chamadas (`findMany`, `create`…) em SQL, e mantém o código em sincronia com a estrutura do banco. |
| O que uma Migration faz? | Converte a mudança do schema em um arquivo `.sql` versionado (`CREATE/ALTER TABLE`), aplicável na mesma ordem em qualquer ambiente. É o histórico reproduzível da estrutura do banco. |
| O que é um relacionamento? | Um vínculo entre linhas de tabelas diferentes, via chave estrangeira (`Post.userId` referencia `User.id`). Permite navegar de um lado a outro (`post.user`, `user.posts`). |
| Por que `Post` tem `userId`? | É a FK que diz **de quem é o post**. Sem ela não há como saber o autor nem aplicar a regra de propriedade. |
| Por que `Comment` tem `userId` **e** `postId`? | Um comentário pertence a duas coisas ao mesmo tempo: **quem escreveu** (`userId`) e **onde** (`postId`). |
| Por que `userId` não vem do Body numa rota autenticada? | O Body é controlado pelo cliente — ele poderia se passar por outro usuário. A identidade confiável está no JWT assinado pelo servidor (`req.user`). |
| `findMany` vs `findUnique`? | `findMany` → lista (0..N), aceita `where`/`orderBy`/`skip`/`take`. `findUnique` → 0 ou 1 registro, só por campo único (`id`, `email`, chave composta); devolve `null` se não achar. |
| Quando usar `create`? | Inserir um registro novo. Não passar `id`/`createdAt` (gerados). |
| Quando usar `update`? | Alterar campos de um registro existente (`where` + `data`); só mexe no que está em `data`. Lança `P2025` se não existir. |
| Quando usar `delete`? | Remover um registro existente (`where`). Também lança `P2025` se não existir. `deleteMany` para vários / sem erro se zero. |
| O que `include` faz? | Traz os **relacionamentos** junto do registro (`include: { user: true }`), mantendo todos os campos escalares do registro principal. |
| O que `select` faz? | Escolhe **exatamente** quais campos voltam (escalares e/ou relações). Serve para **omitir** `password`. `include` e `select` não se misturam no mesmo nível. |
| O que `@@unique([userId, postId])` garante? | No nível do banco: no máximo **uma** linha de `Reaction` por par (usuário, post). A 2ª tentativa de `create` viola a constraint — por isso usamos `upsert`. |
| Como JWT e Prisma trabalham juntos? | JWT diz **quem é** o usuário (id no `sub`); Prisma busca/grava os dados **desse** usuário. O token nunca carrega dados do banco além do id/email. |
| Autenticação vs autorização? | Autenticação = *quem é você* (login, validar o token → `401`). Autorização = *o que você pode fazer* (é o dono do recurso? → `403`). |
| Por que reiniciar não apaga mais os dados? | Porque agora eles moram no PostgreSQL (disco), fora do processo Node. Reiniciar a API não toca no banco. |

---

## 7. Checklist final

| Item | Status |
|---|---|
| PostgreSQL configurado | ✅ (`.env` com `DATABASE_URL`; Postgres local precisa estar de pé) |
| Prisma instalado | ✅ (Prisma 7 + `@prisma/adapter-pg`) |
| `schema.prisma` criado | ✅ |
| Models `User` / `Post` / `Comment` / `Reaction` | ✅ (com enum + `@@unique`) |
| Migration executada | ✅ (2 migrations) |
| `PrismaService` configurado | ✅ (variante com adapter; sem `onModuleInit` — opcional) |
| Arrays em memória removidos | ❌ `UsersService` ainda tem o array (§3.1) |
| Cadastro de usuário usa Prisma | ❌ (§3.1) |
| Login consulta PostgreSQL | ❌ (§3.2) |
| Posts usam Prisma | ✅ |
| Comments usam Prisma | ✅ |
| Reactions usam Prisma | ✅ (`upsert`) |
| JWT continua funcionando | ✅ |
| API Key continua funcionando | ✅ |
| Usuário identificado pelo JWT (não pelo Body) | ❌ `userId` está nos DTOs; falta `@CurrentUser()` (§3.3, §3.4) |
| Propriedade de Posts validada | ❌ (§3.6) |
| Propriedade de Comments validada | ❌ (§3.7) |
| `@@unique([userId, postId])` respeitado | ✅ (via `upsert`) |
| Relacionamentos carregados corretamente | ⚠️ parcial — `findOne` só inclui `comments` (§3.9) |
| Senha nunca retornada | ⚠️ hoje via destructuring manual; com Prisma, usar `select` (§3.1, §3.9) |
| Dados permanecem após reiniciar | ⚠️ ok p/ Post/Comment/Reaction; User depende de §3.1/§3.2 |
| `401`, `403`, `404` usados corretamente | ⚠️ `401`/`404` ok; `403` só via `ApiKeyGuard` — falta o `403` de propriedade (§3.6) |
| `DELETE` de reação | ❌ endpoint não existe (§3.8) |

---

## 8. Checklist de implementação passo a passo (para a IA executar)

> **Instruções para a IA:** implemente **um tópico por vez**, na ordem (T1 → T12). Ao terminar um tópico, rode o bloco **"Como validar"** e só então passe ao próximo — não avance com o anterior no vermelho. **Não** adicione nada fora desta lista (sem Swagger, RBAC, roles, upload, Helmet, etc.). Mantenha o estilo do código existente (imports por caminho absoluto tipo `src/...`, `bcryptjs`, DTOs `class-validator`). As rotas atuais **não mudam de caminho** — só ganham Guards, `@CurrentUser()` e checagens; a única rota nova é o `DELETE` de reação (T7) e as de bônus (T9–T11).
>
> **Decisões já tomadas:** rotas de comentário/reação continuam como estão (`POST /comments/:postId`, `GET/PATCH/DELETE /comments/:id`, `POST /posts/:postId/reaction`); **não** renomear para o formato aninhado do enunciado. Não mexer nos nomes de campo do schema (`Post.updateAt`, `Comment.CreatedAt`) — usar como o client gerado expõe. Nenhuma migration nova.

### T1 — `UsersService` para Prisma (+ senha fora da resposta + e-mail duplicado → 409)

**Objetivo:** remover o array em memória; todo o CRUD de usuário passa a usar `this.prismaService.user.*`, sem nunca devolver `password`.
**Arquivos:** `src/users/user.service.ts`, `src/users/users.controller.ts`.

- [ ] Em `user.service.ts`: apagar `private readonly users: User[]`, os seeds Ana/Carlos e `private nextId`. Remover o `import { User } from './entities/user.entity'` se ficar sem uso.
- [ ] Definir um `select` reutilizável sem `password`: `{ id: true, name: true, email: true, bio: true, createdAt: true }`.
- [ ] `create(dto)` → `this.prismaService.user.create({ data: { ...dto, password: bcrypt.hashSync(dto.password, 10) }, select: {…} })`. Envolver em `try/catch`: se `err.code === 'P2002'` → `throw new ConflictException('E-mail já cadastrado')` (importar `ConflictException` de `@nestjs/common`).
- [ ] `findAll()` → `this.prismaService.user.findMany({ select: {…} })`.
- [ ] `findOne(id)` → `this.prismaService.user.findUnique({ where: { id }, select: {…} })`; se `null` → `NotFoundException(`Usuário ${id} não encontrado`)`.
- [ ] `findByName(name)` → `this.prismaService.user.findMany({ where: { name: { contains: name, mode: 'insensitive' } }, select: {…} })`.
- [ ] `findByEmail(email)` → `this.prismaService.user.findUnique({ where: { email } })` — **sem `select`** (o login precisa do `password` para o `bcrypt.compare`). Manter `async`.
- [ ] `update(id, dto)` → chamar `await this.findOne(id)` primeiro (404); se `dto.password` → `dto.password = bcrypt.hashSync(dto.password, 10)`; `this.prismaService.user.update({ where: { id }, data: dto, select: {…} })`.
- [ ] `remove(id)` → `await this.findOne(id)` (404); `this.prismaService.user.delete({ where: { id } })`; retornar `{ removed: true }`.
- [ ] Em `users.controller.ts` `create()`: **remover** o `bcrypt.hash` do controller (hoje há hash duplo — controller + service) e **remover** o bloco quebrado `const existUser = this.usersService.validateEmail(...)` + `if (!existUser) throw new UnauthorizedException('Emaill já cadastrado')`. Passar `{ ...createUserDto, bio }` direto ao service. Limpar imports órfãos (`bcrypt`, `UnauthorizedException`).
- [ ] Remover o método `validateEmail` do service (deixou de ser usado).

**Como validar:** com `x-api-key: 123456` + `Authorization: Bearer <token>`:
- `POST /users` cria e a resposta **não** contém `password`.
- Repetir o `POST` com o mesmo e-mail → **409**.
- `GET /users` e `GET /users/:id` → sem `password`. `GET /users/999999` → **404**.

### T2 — Login e refresh consultam o PostgreSQL (+ prova de restart)

**Objetivo:** o login para de ler o array (que nem existe mais) e passa a ler o banco.
**Arquivos:** `src/auth/auth.service.ts`.

- [ ] `validateUser(email, password)` → `const user = await this.usersService.findByEmail(email)` (adicionar o `await` que falta).
- [ ] `refreshTokens(...)` → `const user = await this.usersService.findByEmail(payload.email)` (idem).
- [ ] Confirmar que `login` continua montando `payload = { sub: user.id, email: user.email }` e que `generateTokens` não mudou.

**Como validar (Testes A/B/C do enunciado):**
- Criar usuário → `POST /auth/login` devolve `access_token` (+ `refresh_token`).
- **Parar a aplicação e subir de novo.** `POST /auth/login` com o mesmo usuário ainda funciona.
- `GET /users`, `GET /posts` continuam mostrando os registros criados antes do restart.

### T3 — `@CurrentUser()` + remover `userId` dos DTOs

**Objetivo:** ter um jeito tipado de ler o usuário do token e parar de aceitar `userId` pelo Body.
**Arquivos:** novo `src/auth/decorators/current-user.decorator.ts`; `src/posts/dto/create-post.dto.ts`; `src/posts/dto/create-reaction.dto.ts`; `src/comments/dto/create-comment.dto.ts`.

- [ ] Criar `current-user.decorator.ts`:
  ```ts
  import { createParamDecorator, ExecutionContext } from '@nestjs/common';
  import { AuthUser } from 'src/auth/interfaces/auth-user.interfaces';

  export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthUser =>
      ctx.switchToHttp().getRequest().user,
  );
  ```
- [ ] `CreatePostDto`: remover o campo `userId` e o `@IsInt()` dele. Manter só `text`.
- [ ] `CreateReactionDto`: remover `userId` (e `@IsInt`/`@IsNotEmpty` dele). Manter `type` (`@IsEnum(ReactionType)`).
- [ ] `CreateCommentDto`: remover `userId`. Manter `text`.
- [ ] Conferir que `UpdatePostDto` e `UpdateCommentDto` (ambos `PartialType(...)`) deixam de expor `userId` sozinhos — nada a fazer além de compilar.

**Como validar:** projeto compila; um `POST /posts` que envie `"userId": 99` no corpo tem esse campo descartado pelo `whitelist: true` do `ValidationPipe` global.

### T4 — Proteger as rotas de escrita de Posts / Comments / Reactions

**Objetivo:** nenhuma escrita sem API Key + JWT.
**Arquivos:** `src/posts/posts.controller.ts`, `src/comments/comments.controller.ts`, `src/posts/posts.module.ts`, `src/comments/comments.module.ts`.

- [ ] Importar `JwtAuthGuard` de `src/auth/jwt-auth.guard` e `ApiKeyGuard` de `src/guard/guard.service` nos dois controllers.
- [ ] Aplicar `@UseGuards(ApiKeyGuard, JwtAuthGuard)` em: `POST /posts`, `PATCH /posts/:id`, `DELETE /posts/:id`, `POST /posts/:postId/reaction`, `POST /comments/:postId`, `PATCH /comments/:id`, `DELETE /comments/:id`. (Mesmo par usado hoje em `POST/PUT /users`. Se preferir só identidade, use apenas `JwtAuthGuard` — mas mantenha consistente.)
- [ ] Deixar as rotas `GET` (`/posts`, `/posts/:id`, `/comments`, `/comments/:id`) **sem** Guard.
- [ ] Adicionar `GuardModule` (de `src/guard/guard.module`) aos `imports` de `PostsModule` e `CommentsModule` (necessário para o `ApiKeyGuard` ser resolvido). `JwtAuthGuard` **não** exige importar `AuthModule` — a strategy `jwt` já é registrada globalmente pelo `AuthModule` que está no `AppModule`.

**Como validar:**
- `POST /posts` sem header `x-api-key` → **403**.
- Com `x-api-key` correto mas sem `Authorization` → **401**.
- Com os dois válidos → passa para o handler.

### T5 — O autor vem do JWT (não do Body)

**Objetivo:** `post.userId` / `comment.userId` / `reaction.userId` passam a vir de `@CurrentUser()`.
**Arquivos:** `src/posts/posts.controller.ts` + `src/posts/posts.service.ts`; `src/comments/comments.controller.ts` + `src/comments/comments.service.ts`.

- [ ] `PostsController.create` → `@CurrentUser() user: AuthUser`; `return this.postsService.create(user.id, { text })`.
- [ ] `PostsService.create(userId: number, dto)` → `this.prismaService.post.create({ data: { text: dto.text, userId } })`.
- [ ] `PostsController.createReaction` → `@CurrentUser() user`; `return this.postsService.createReaction(user.id, postId, createReactionDto)`.
- [ ] `PostsService.createReaction(userId: number, postId: number, dto)` → `await this.findOne(postId)` (404 se o post não existe); `this.prismaService.reaction.upsert({ where: { userId_postId: { userId, postId } }, create: { type: dto.type, userId, postId }, update: { type: dto.type } })`.
- [ ] `CommentsController.create` → `@CurrentUser() user`; `return this.commentsService.create(user.id, postId, { text })`.
- [ ] `CommentsService.create(userId: number, postId: number, dto)` → `const post = await this.prismaService.post.findUnique({ where: { id: postId } })`; se `null` → `NotFoundException(`Post ${postId} não encontrado`)`; depois `this.prismaService.comment.create({ data: { text: dto.text, userId, postId } })`.

**Como validar:** autenticado como Ana, `POST /posts` com `"userId": <id do Carlos>` no corpo → o post criado tem `userId` = id da **Ana**. `POST /comments/999999` → **404**.

### T6 — Propriedade dos recursos (403)

**Objetivo:** só o dono altera/exclui o próprio Post; só o autor exclui o próprio Comment.
**Arquivos:** `src/posts/posts.controller.ts` + `src/posts/posts.service.ts`; `src/comments/comments.controller.ts` + `src/comments/comments.service.ts`.

- [ ] `PostsController.update` e `remove` → `@CurrentUser() user`; passar `user.id` ao service.
- [ ] `PostsService.update(id, userId, dto)` → buscar o post (`findUnique({ where: { id } })`); `null` → `NotFoundException`; `post.userId !== userId` → `ForbiddenException('Você não é o dono deste post')`; só então `post.update({ where: { id }, data: dto })`.
- [ ] `PostsService.remove(id, userId)` → mesmo padrão de 404 + 403; só então `post.delete({ where: { id } })`.
- [ ] `CommentsController.remove` (e, por consistência, `update`) → `@CurrentUser() user`; passar `user.id`.
- [ ] `CommentsService.remove(id, userId)` → `const comment = await this.findOne(id)` (já lança 404); `comment.userId !== userId` → `ForbiddenException`; só então `comment.delete({ where: { id } })`.
- [ ] Nota: como a rota é `/comments/:id` (sem `postId` na URL), a checagem "o comentário pertence a este post" do enunciado não se aplica aqui — registrar isso num comentário no código.
- [ ] Importar `ForbiddenException` de `@nestjs/common` onde for usado.

**Como validar (Etapa 25):** Ana cria o Post 1. Carlos (autenticado) em `PATCH /posts/1` e `DELETE /posts/1` → **403**. Ana nas mesmas rotas → sucesso. Carlos tentando `DELETE /comments/<id de um comentário da Ana>` → **403**.

### T7 — `DELETE /posts/:postId/reaction` (retirar a própria reação)

**Objetivo:** o usuário remove a reação dele naquele post sem informar `reactionId` nem `userId`.
**Arquivos:** `src/posts/posts.controller.ts`, `src/posts/posts.service.ts`.

- [ ] Novo handler `@Delete(':postId/reaction')` com `@UseGuards(ApiKeyGuard, JwtAuthGuard)`, `@Param('postId', ParseIntPipe) postId: number` e `@CurrentUser() user: AuthUser` → `return this.postsService.removeReaction(user.id, postId)`.
- [ ] `PostsService.removeReaction(userId: number, postId: number)` → `await this.findOne(postId)` (404 se o post não existe); `this.prismaService.reaction.deleteMany({ where: { userId, postId } })` (não lança se não houver reação). Retornar `{ removed: true }` ou o resultado.

**Como validar:** criar `LIKE` no post; `DELETE /posts/:postId/reaction` → 200; `GET /posts/:postId` não lista mais a reação daquele usuário; repetir o `DELETE` → segue sem erro.

### T8 — Relacionamentos ricos, sem `password` em nenhum nível

**Objetivo:** `GET /posts/:id` traz autor + comentários (com autor) + reações (com autor); `GET /posts` traz o autor.
**Arquivos:** `src/posts/posts.service.ts`.

- [ ] `findOne(id)`:
  ```ts
  const post = await this.prismaService.post.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      comments: { include: { user: { select: { id: true, name: true } } } },
      reactions: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!post) throw new NotFoundException(`Post ${id} não encontrado`);
  return post;
  ```
- [ ] `findAll()` → `this.prismaService.post.findMany({ include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } })`.
- [ ] Conferir que `update` / `remove` / `createReaction` / `removeReaction` (que chamam `findOne` internamente para checar 404/dono) continuam funcionando — eles só leem `post.userId` e a existência, o payload maior não atrapalha.

**Como validar (Etapa 21):** `GET /posts/:id` devolve `user`, `comments[].user`, `reactions[].user` e **nenhum** campo `password` em qualquer nível do JSON.

### T9 (bônus) — `GET /users/:userId/posts`

**Arquivos:** `src/users/users.controller.ts`, `src/users/user.service.ts`.

- [ ] `@Get(':userId/posts')` no `UsersController` (o Nest resolve essa antes de `@Get(':id')` por ser mais específica) → `return this.usersService.findPostsByUser(userId)` com `@Param('userId', ParseIntPipe)`.
- [ ] `findPostsByUser(userId)` → `this.prismaService.post.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })`. (Anotar em comentário a variante partindo de `User`: `user.findUnique({ where: { id: userId }, include: { posts: true } })`.)

**Como validar:** retorna apenas os posts daquele usuário, mais recentes primeiro.

### T10 (bônus) — `GET /feed`

**Arquivos:** `src/posts/posts.controller.ts`, `src/posts/posts.service.ts`.

- [ ] `@Get('feed')` **declarado antes** de `@Get(':id')` no `PostsController` (senão a rota `:id` captura a string `"feed"`). Público (sem Guard).
- [ ] `PostsService.feed()` → `this.prismaService.post.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } }, _count: { select: { comments: true, reactions: true } } } })`.

**Como validar:** posts do mais novo para o mais antigo, cada um com `user` e `_count.comments` / `_count.reactions`.

### T11 (bônus) — `GET /stats`

**Arquivos:** novos `src/stats/stats.module.ts` + `src/stats/stats.controller.ts` (importando `PrismaModule`); registrar `StatsModule` em `src/app.module.ts`. (Alternativa mais curta: um `@Get('stats')` no `AppController` injetando `PrismaService` — mas aí `AppModule` precisa do `PrismaModule` já importado, que está.)

- [ ] Handler `@Get('stats')` → 
  ```ts
  const [users, posts, comments, reactions] = await Promise.all([
    this.prisma.user.count(),
    this.prisma.post.count(),
    this.prisma.comment.count(),
    this.prisma.reaction.count(),
  ]);
  return { users, posts, comments, reactions };
  ```

**Como validar:** os quatro números batem com o conteúdo do banco.

### T12 (bônus) — Verificar a cascata `onDelete: Cascade` (sem código)

- [ ] Criar um Post, 2 comentários e 1 reação nele; anotar os ids.
- [ ] `DELETE /posts/:id` autenticado como o dono.
- [ ] Conferir no banco (`npx prisma studio --config prisma7.config.ts` ou `psql`) que os `Comment` e `Reaction` daquele post **sumiram** e que os `User` envolvidos **continuam**. Explicar por quê (FK com `ON DELETE CASCADE` em `Comment`/`Reaction` → `Post`; a FK para `User` é `RESTRICT`).

### Fecho — Revalidar a matriz de testes (Seção 5 / Etapas 23–26)

- [ ] Reexecutar todas as linhas da tabela da Seção 5. Todas as marcadas hoje como ❌ ou ⚠️ devem passar a ✅.
- [ ] Atualizar a Seção 5 e a Seção 7 (checklist final) deste documento marcando o que foi concluído.

---

## 9. Referências de arquivo

- Código: `devconnect/src/**`
- Schema: `devconnect/prisma/schema.prisma`
- Migrations: `devconnect/prisma/migrations/`
- Dependências/scripts: `devconnect/package.json` · Config do CLI: `devconnect/prisma7.config.ts`
- **Relatório técnico atual e fiel:** `devconnect/docs/RELATORIO-DEVCONNECT.md`
- ⚠️ Desatualizados (não usar como fonte): `devconnect/README.md`, `devconnect/RELATORIO-CONTEXTO-IA.md`

*Documento gerado a partir da leitura do código-fonte real em 2026-08-28.*
