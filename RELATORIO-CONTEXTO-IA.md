# Contexto DevConnect — Guards, Pipes, Interceptors, Prisma e JWT

> **Como usar este documento**: cole isto como a primeira mensagem numa conversa nova do Claude.ai (ou anexe o arquivo). A partir daqui, você (Claude.ai) tem todo o contexto do meu material de estudo e do estado real do meu projeto NestJS chamado **DevConnect**. **Eu quero implementar o código sozinho, manualmente** — seu papel é de tutor/revisor: explique os conceitos com as mesmas analogias do material, me faça perguntas quando eu propuser código, aponte erros no que eu escrever e confira se bate com os "critérios de saída" de cada dia. Não escreva os arquivos inteiros por mim a menos que eu peça explicitamente um exemplo pontual — meu objetivo é praticar.
>
> Meu foco imediato é **Dia 2 (Pipe) → Dia 3 (Interceptor) → Dia 4 (juntando as três peças)** da Semana 3. Depois disso, quero fechar as lacunas que restaram nas Semanas 4 (Prisma) e 5 (Auth JWT), listadas mais abaixo.

---

## 1. Visão geral do projeto

**DevConnect** é uma API NestJS de rede social fictícia (posts, comentários, reações, usuários com login). Stack real (do `package.json`):

- NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`)
- `@nestjs/config` (leitura de `.env` via `ConfigService`)
- `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` (autenticação JWT)
- Prisma 7 + `@prisma/adapter-pg` + `pg` (PostgreSQL)
- `bcryptjs` (hash de senha)
- `class-validator` / `class-transformer` (DTOs + `ValidationPipe` global)
- TypeScript 5.7, Jest 30

### Modelo de dados (`prisma/schema.prisma`)

```prisma
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
  updateAt  DateTime   @updatedAt
}

model Comment {
  id        Int      @id @default(autoincrement())
  text      String
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  postId    Int
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  CreatedAt DateTime @default(now())
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

### Estrutura de pastas real (`src/`)

```text
src/
├── app.module.ts
├── main.ts                        # bootstrap + ValidationPipe global
├── auth/
│   ├── auth.module.ts             # JwtModule.registerAsync + PassportModule
│   ├── auth.controller.ts         # POST /auth/login, GET /auth/profile
│   ├── auth.service.ts            # validateUser(), login()
│   ├── jwt.strategy.ts            # Passport JwtStrategy
│   ├── jwt-auth.guard.ts          # AuthGuard('jwt')
│   └── dto/login.dto.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts        # POST protegido por ApiKeyGuard; resto público
│   ├── user.service.ts            # AINDA em memória (ver Seção 3)
│   ├── dto/create-user.dto.ts, update-user.dto.ts
│   └── entities/user.entity.ts
├── posts/
│   ├── posts.module.ts
│   ├── posts.controller.ts        # sem Guard nenhum
│   ├── posts.service.ts           # 100% Prisma
│   └── dto/create-post.dto.ts, update-post.dto.ts, create-reaction.dto.ts
├── comments/
│   ├── comments.module.ts
│   ├── comments.controller.ts     # sem Guard nenhum
│   ├── comments.service.ts        # 100% Prisma
│   └── dto/create-comment.dto.ts, update-comment.dto.ts
├── guard/
│   ├── guard.module.ts
│   └── guard.service.ts           # ApiKeyGuard (única peça de Guard do projeto)
└── prisma/
    ├── prisma.module.ts
    └── prisma.service.ts          # extends PrismaClient + @prisma/adapter-pg
```

### Diagrama de fluxo de uma requisição (o que a Semana 3 ensina, ponto de partida mental)

```text
requisição chega
    |
    v
Guard         — decide se a requisição pode entrar
    |
    v
Interceptor   — liga a "câmera", começa a registrar
    |
    v
Pipe          — confere se o formato dos dados está certo
    |
    v
Controller → Service → dados
    |
    v
Interceptor   — desliga a "câmera", registra o resultado
    |
    v
resposta volta pro cliente
```

---

## 2. Resumo do material de estudo (as 3 semanas)

### Semana 3 — Guards, Pipes, Interceptors

**Dia 1 — Guard (a portaria).** Analogia: segurança que confere o crachá antes de deixar entrar. `canActivate(context): boolean` é o único método obrigatório. Decide **se** a requisição entra — nada de formato de dados, isso é trabalho do Pipe.

```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    if (!apiKey || apiKey !== '12345') return false;
    return true;
  }
}
```
Aplica-se com `@UseGuards(ApiKeyGuard)`. Critério de saída: escrever um Guard novo do zero (regra diferente) e aplicar numa rota, sem exemplo.

**Dia 2 — Pipe (a conferência de documento).** Analogia: confere se o formulário está preenchido certo, não decide se a pessoa entra. Dois tipos:
1. **Pronto** — DTO + `class-validator`, disparado pelo `ValidationPipe` global.
2. **Customizado** — quando a regra é específica demais pro `class-validator`.

```typescript
@Injectable()
export class NameValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    const name = String(value);
    if (/\d/.test(name)) {
      throw new BadRequestException('O nome não pode conter números');
    }
    return name;
  }
}
```
Aplica-se em parâmetro: `@Param('name', NameValidationPipe)`. Critério de saída: explicar a diferença entre os dois tipos de Pipe e escrever um Pipe customizado novo sem consultar exemplo.

**Dia 3 — Interceptor (o diário de bordo).** Analogia: câmera que liga quando o visitante entra e só desliga quando sai — registra do início ao fim sem interferir.

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    return next.handle().pipe(
      tap(() => {
        const time = Date.now() - start;
        console.log(`[RESPONSE] ${req.method} ${req.url} - ${time}ms`);
      }),
    );
  }
}
```
`tap()` (RxJS) "espia" o resultado sem mudar ele. Pode ser local (`@UseInterceptors(...)`) ou global (`app.useGlobalInterceptors(new LoggingInterceptor())` no `main.ts`). O cálculo de `time` só pode acontecer dentro do `tap()` porque é aí que a resposta do Controller/Service já voltou — antes disso, `next.handle()` só devolveu um Observable "promessa", não o valor. Critério de saída: explicar por que o Interceptor consegue "envolver" a requisição inteira, e escrever um Interceptor simples novo.

**Dia 4 — Juntando as três peças.** Ordem de execução: **Guard → Interceptor (liga) → Pipe → Controller/Service → Interceptor (desliga) → resposta**. Ponto-chave: o Guard roda antes de tudo — se ele barrar, nem o Interceptor loga a tentativa. Testar 3 cenários numa mesma rota: (1) sem crachá — barra no Guard, nenhum log aparece; (2) crachá certo, dado mal formatado — passa o Guard, o Interceptor loga o início, o Pipe barra antes do Controller; (3) tudo certo — passa pelas 5 etapas. Critério de saída: prever corretamente onde uma requisição vai parar dado um cenário de erro novo.

**Dia 5 — Fechamento.** Aplicar as 3 peças (Guard aplicado, DTO validado, Interceptor global já cobre) numa rota nova do zero, sem copiar exemplo, e testar os 3 cenários de erro nela também.

### Semana 4 — Prisma (persistência)

**Dia 1 — `schema.prisma` é a planta baixa.** Array em memória = post-it (some ao reiniciar); banco = cofre trancado. `@id`, `@default(autoincrement())`, `@default(now())`. Migration = reforma registrada (`npx prisma migrate dev --name x`), gera o SQL (`CREATE TABLE`/`ALTER TABLE`) e versiona a estrutura do banco junto com o código.

**Dia 2 — `PrismaService` é o atendente do cofre.**
```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() { await this.$connect(); }
}
```
(No DevConnect real, a variante usada é com `@prisma/adapter-pg` — ver Seção 3, é equivalente.) `PrismaModule` precisa `providers: [PrismaService]` **e** `exports: [PrismaService]` — sem `exports`, nenhum outro módulo consegue injetar. Depois de definir um `model`, o Prisma gera sozinho `this.prisma.<model>.create/findMany/findUnique/update/delete`.

**Dia 3 — `findAll`/`findOne`.** `findMany()` sem argumento retorna tudo. `findUnique({ where: { id } })` retorna `null` se não achar — não lança erro sozinho, então é preciso checar manualmente e lançar `NotFoundException`.

**Dia 4 — `update`/`remove`.** `update({ where, data })` só altera os campos presentes em `data`. Diferente de `findUnique`, `update`/`delete` **lançam erro** (código `P2025`) se o registro não existir — sem tratar, vira 500 genérico; o padrão ensinado é `try { ... } catch { throw new NotFoundException(...) }` (no DevConnect real, `PostsService`/`CommentsService` usam uma variante equivalente: chamar `findOne(id)` — que já lança `NotFoundException` — antes do `update`/`delete`).

**Dia 5 — Fechamento.** Provar persistência reiniciando o servidor; auditar que nenhuma chamada `this.prisma.*` vaza para o Controller (tudo deve passar pelo Service).

### Semana 5 — Autenticação JWT

**Dia 1 — `model User`.** `email String @unique` — a planta baixa proíbe e-mail duplicado antes de qualquer validação em código.

**Dia 2 — Cadastro e hash com bcrypt.** Nunca guardar senha em texto puro — `bcrypt.hash(senha, 10)` não tem `unhash()`, só `compare()`. Checar e-mail existente **antes** do hash (evita custo de hashear à toa). Resposta de `register` nunca deve devolver `user` inteiro (a senha, mesmo hasheada, não deve circular).

**Dia 3 — Login e o "crachá temporário" (JWT).**
```typescript
async validateUser(email: string, password: string) {
  const user = await this.usersService.findByEmail(email);
  if (!user) return null;
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return null;
  const { password: _, ...result } = user;
  return result;
}

async login({ email, password }: LoginDto) {
  const user = await this.validateUser(email, password);
  if (!user) throw new UnauthorizedException('Credenciais inválidas');
  const payload = { sub: user.id, email: user.email };
  const accessToken = await this.jwtService.signAsync(payload);
  return { access_token: accessToken };
}
```
`sub` = "subject" (convenção JWT para "de quem é este token"). **O payload do JWT não é criptografado, só assinado** — qualquer um com o token consegue ler o conteúdo, então nunca colocar senha/hash/dados sensíveis nele. `JWT_SECRET` vem do `.env`, nunca hardcoded — quem tiver o segredo consegue forjar tokens válidos (ex.: um token com `role: admin` fabricado à mão). Senha incorreta e e-mail inexistente devolvem a **mesma** mensagem genérica (`401 Credenciais inválidas`) — resposta separada permitiria enumeração de usuários cadastrados.

**Dia 4 — `JwtStrategy` + `JwtAuthGuard`.**
```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }
  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email }; // vira req.user
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```
Diferente do `ApiKeyGuard` (Semana 3), aqui o Guard costuma proteger a **classe inteira** do Controller (`@UseGuards(JwtAuthGuard)` em cima do `@Controller(...)`), não só um método.

**Dia 5 — Fechamento: auditoria de segurança.** Revisar **todos** os controllers e preencher: "rota → protegida por JwtAuthGuard? → deveria estar?". Fechar qualquer rota esquecida sem proteção; confirmar que rotas de `register`/`login` continuam abertas de propósito.

---

## 3. Estado real do projeto DevConnect (lido do código-fonte, não do README — o README está desatualizado)

### O que já está pronto e funcionando

| Módulo | Situação |
|---|---|
| `ApiKeyGuard` (`src/guard/guard.service.ts`) | Implementado, lê `x-api-key` contra `process.env.APIKEY` (variável de ambiente, não string fixa — mais avançado que o exemplo do Dia 1). Aplicado só em `POST /users`. |
| `ValidationPipe` global (`main.ts`) | `whitelist: true, transform: true`. DTOs com `class-validator` em `users`, `posts`, `comments`, `login`. Cobre o Dia 2 Blocos 1-3. |
| `PrismaService` (`src/prisma/prisma.service.ts`) | Funcional, usa `@prisma/adapter-pg` (variante válida do padrão do Dia 2 da Semana 4). |
| `PostsService` / `CommentsService` | 100% migrados para Prisma. Padrão de "checar existência antes de update/remove" já aplicado (`findOne` lança `NotFoundException`, chamado antes de `update`/`delete`). |
| `AuthModule`/`AuthService`/`AuthController`/`JwtStrategy`/`JwtAuthGuard`/`LoginDto` | Implementados e batendo de perto com o material da Semana 5 (`validateUser`, `login`, payload `{ sub, email }`, `signAsync`). |
| `model User/Post/Comment/Reaction` no `schema.prisma` | Completo, com relations, enum `ReactionType` e `@@unique([userId, postId])` — mais avançado que o material (que só chega até `model User` isolado). |

### O que falta (Semana 3 — foco imediato)

| Item | Status | Detalhe |
|---|---|---|
| Pipe customizado (Dia 2, Blocos 4-5) | ❌ Ausente | Nenhum arquivo `*.pipe.ts` no projeto. Só validação via DTO existe. |
| Interceptor (Dia 3, todo o dia) | ❌ Ausente | Nenhum arquivo `*.interceptor.ts`. Nenhum log de requisição/resposta. |
| Juntar as 3 peças (Dia 4) | ❌ Bloqueado | Impossível concluir sem Interceptor. Hoje só Guard+Pipe(DTO) se encontram, e só em `POST /users`. `PostsController`/`CommentsController` não têm Guard nenhum. |

### O que falta (Semana 4 — Prisma)

| Item | Status | Detalhe |
|---|---|---|
| `UsersService` migrado para Prisma | ❌ **Maior lacuna do projeto** | `src/users/user.service.ts` ainda usa `private readonly users: User[]` (array em memória) para `create/findAll/findOne/update/remove`, apesar de já injetar `PrismaService` no construtor. Só o método `validateEmail(email)` usa `this.prismaService.user.findFirst(...)`. Ou seja: o `model User` existe no banco, mas o CRUD de usuário não fala com ele — os dados de usuário se perdem a cada restart, diferente de Post/Comment. |

### O que falta / precisa de decisão (Semana 5 — Auth JWT)

| Item | Status | Detalhe |
|---|---|---|
| Auditoria de rotas protegidas (Dia 5) | ⚠️ Pendente | `JwtAuthGuard` só está em `GET /auth/profile`. Nenhuma rota de `Users`, `Posts` ou `Comments` exige token — inclusive `POST/PATCH/DELETE /users`, que deveriam quase certamente exigir. |
| `POST /auth/register` | ❌ Ausente | O material da Semana 5 (Dia 2) ensina autocadastro aberto via `POST /auth/register`. No projeto real, cadastro acontece via `POST /users`, atrás do `ApiKeyGuard` (chave fixa de admin) — um desenho diferente, não necessariamente errado, mas vale decidir conscientemente qual dos dois padrões o projeto quer (ou os dois, com propósitos diferentes). |

### Bugs reais encontrados (não fazem parte do "gap" do currículo, mas travam o comportamento esperado)

1. **`.env` tem a chave `JWR_EXPIRES_IN` (typo — falta o T), em vez de `JWT_EXPIRES_IN`.** O código em `auth.module.ts` lê `configService.get<string>('JWT_EXPIRES_IN')`, nunca encontra, e cai no fallback hardcoded `'30s'`. **Resultado: todo `access_token` gerado hoje expira em 30 segundos**, independente do que estiver escrito no `.env`. Correção: renomear a chave no `.env` para `JWT_EXPIRES_IN`.
2. **Em `src/users/users.controller.ts`, `create()` chama `this.usersService.validateEmail(createUserDto.email)` sem `await`.** Como `validateEmail` é `async`, a expressão sempre retorna uma `Promise` (que é *truthy*), então `if (!existUser) throw new UnauthorizedException(...)` nunca dispara — a checagem de e-mail duplicado está morta. Some a isso o fato de `create()` do `UsersService` ainda gravar no array em memória (não no Prisma), então nem a constraint `@unique` do banco está protegendo esse caminho. Corrigir isso depende de resolver a lacuna do item anterior (migrar `UsersService` para Prisma) — nesse ponto a própria constraint `@unique(email)` do banco passaria a barrar duplicados, e o `await` ausente deveria ser corrigido de qualquer forma.

---

## 4. Roteiro de implementação priorizado

### Passo 1 — Dia 2: Pipe customizado (foco imediato)

Objetivo: criar um Pipe customizado real para o DevConnect, seguindo o padrão do `NameValidationPipe` do material, mas aplicado a uma regra que faça sentido no projeto — por exemplo, recusar texto de post/comentário vazio-de-espaços-só, ou impedir caracteres especiais no `name` do usuário. Estrutura esperada (adaptar ao meu código, sem copiar):

```typescript
// src/common/pipes/no-special-chars.pipe.ts (sugestão de local)
@Injectable()
export class NoSpecialCharsPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    const text = String(value);
    if (/[!@#$%^&*()]/.test(text)) {
      throw new BadRequestException('Texto não pode conter caracteres especiais');
    }
    return text;
  }
}
```
Aplicar num `@Param(...)` ou como pipe de um campo específico. Testar: (a) valor com caractere especial → erro; (b) valor limpo → passa.

### Passo 2 — Dia 3: Interceptor

Objetivo: criar `LoggingInterceptor` (mesmo padrão do material) e decidir se aplica global (`main.ts`, via `app.useGlobalInterceptors(new LoggingInterceptor())`) ou local (`@UseInterceptors(...)` num controller). Recomendo global no DevConnect, porque cobre `Auth`/`Users`/`Posts`/`Comments` de uma vez.

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    return next.handle().pipe(
      tap(() => console.log(`[RESPONSE] ${req.method} ${req.url} - ${Date.now() - start}ms`)),
    );
  }
}
```
Testar em pelo menos 3 rotas diferentes do projeto real (ex.: `GET /posts`, `POST /comments/:postId`, `GET /users/:id`) e comparar tempos.

### Passo 3 — Dia 4: juntar Guard + Interceptor + Pipe numa rota real

Sugestão de rota-alvo no DevConnect: `POST /posts` ou `POST /comments/:postId` (hoje sem Guard nenhum). Combinar:
- `ApiKeyGuard` já existente (ou decidir se essa rota deveria usar `JwtAuthGuard` em vez disso — ver Passo 4);
- DTO já validado (`CreatePostDto`/`CreateCommentDto`) + o Pipe customizado do Passo 1, se fizer sentido no mesmo campo;
- `LoggingInterceptor` do Passo 2 (se global, já cobre automaticamente).

Prever por escrito, **antes de testar**, o que acontece em 3 cenários e onde a requisição para: (1) sem credencial do Guard; (2) credencial certa, corpo mal formatado; (3) tudo certo. Depois testar de verdade e comparar.

### Passo 4 — Fechar o restante (depois do foco imediato)

Em ordem sugerida:
1. **Migrar `UsersService` para Prisma por completo** (`create/findAll/findOne/update/remove` via `this.prismaService.user.*`, no padrão que `PostsService`/`CommentsService` já usam) — isso também resolve o bug do e-mail duplicado, porque a constraint `@unique(email)` do banco passa a proteger de verdade, e dá pra corrigir o `await` ausente em `users.controller.ts` no mesmo passo.
2. **Corrigir `JWR_EXPIRES_IN` → `JWT_EXPIRES_IN` no `.env`** para os tokens pararem de expirar em 30 segundos.
3. **Auditoria de rotas (Semana 5 Dia 5)**: decidir e aplicar `JwtAuthGuard` em `Users` (pelo menos `POST/PATCH/DELETE`), `Posts` e `Comments`. Documentar por escrito, rota a rota, o motivo de cada uma estar (ou não) protegida.
4. **Decidir sobre `POST /auth/register`**: manter só o `POST /users` com `ApiKeyGuard` (cadastro "administrativo"), ou adicionar um `register` aberto (autocadastro de usuário comum), ou os dois com propósitos diferentes.

---

## 5. Critérios de saída (para saber quando dar cada etapa por concluída)

**Semana 3 completa:**
1. Explicar a diferença entre Guard, Pipe e Interceptor com uma frase cada.
2. Prever em que ponto uma requisição é barrada, dado um cenário de erro novo.
3. Aplicar as três peças numa rota nova do DevConnect, sem copiar exemplo sem entender.

**Semana 4 completa:**
1. Explicar a diferença entre `schema.prisma` e uma migration.
2. Escrever uma chamada Prisma simples (`findMany`, `findUnique`, `update`, `delete`) sem copiar de exemplo.
3. Provar, na prática, que os dados de `User` também sobrevivem a um restart do servidor (não só Post/Comment).

**Semana 5 completa:**
1. Explicar por que uma senha nunca deve ser guardada em texto puro.
2. Explicar o que o token JWT carrega e por que ele tem validade.
3. Proteger uma rota nova com `JwtAuthGuard`, sabendo dizer o que muda em relação ao `ApiKeyGuard`.
4. A tabela de auditoria de rotas (Passo 4.3 acima) não ter nenhuma rota "deveria estar protegida" sem estar.
