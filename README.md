# DevConnect

API backend em NestJS para uma rede social fictícia, construída como projeto de estudo de um bootcamp de backend. O foco atual é autenticação: login com e-mail/senha, emissão de token JWT e uma rota protegida de exemplo. Não há frontend neste repositório — é só a API.

## Contexto pedagógico

Este repositório é a continuação prática de uma trilha de aprendizado, dia a dia. A "cara" do código (nomes em português misturados com inglês, escolhas simples de propósito didático, alguns atalhos) reflete isso — não é descuido, é o estado normal de um projeto em construção enquanto o conceito seguinte ainda não foi aplicado.

- **Dia 1** — tipos primitivos e funções tipadas em TypeScript.
- **Dia 2** — `interface`: forma de objetos, arrays tipados, campos aninhados.
- **Dia 3** — `class` / POO (`public`/`private`, métodos, `extends`/herança), aplicado então na entidade `Task` de um projeto anterior (`tasks-api`, fora deste repositório).
- **Dia 4** — decorators do NestJS (`@Module`, `@Injectable`, `@Controller`, `@Get`/`@Post`, `@Param`, `@Body`) e como funcionam por baixo dos panos (reflection + metadata).
- **Persistência (planejado, ainda não presente)** — Prisma + PostgreSQL foram introduzidos como o próximo passo da trilha, mas neste repositório os dados continuam em memória (ver Seção "Problemas conhecidos").
- **Desafio atual — Login JWT da rede social DevConnect**: implementar cadastro/login de usuários com senha criptografada, emissão de JWT no login e uma rota protegida que só responde com token válido. É o que está implementado hoje neste repositório (Seções "Módulos" e "Fluxo de autenticação" abaixo).

Se você é a IA que está retomando este projeto: trate as seções 5, 6 e 9 como a fonte de verdade sobre o que o código faz de fato — elas foram escritas lendo o código-fonte real, arquivo por arquivo, não descrevendo a intenção original.

## Stack técnica

Extraída do `package.json` real do projeto:

- **NestJS 11** — `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`.
- **`@nestjs/config`** — leitura do `.env` via `ConfigService`.
- **`@nestjs/jwt`** — geração/verificação de token.
- **`@nestjs/passport` + `passport` + `passport-jwt`** — estratégia de autenticação JWT.
- **`bcryptjs`** — hash de senha. Usado no código (`user.service.ts`, `auth.service.ts`), mas **não está** em `package.json`/`node_modules` — precisa ser instalado antes de rodar (ver Seção 9).
- **`class-validator` / `class-transformer`** — usados em `login.dto.ts` e no `ValidationPipe` global, mas também **ausentes** de `package.json`/`node_modules`.
- **TypeScript 5.7**, **Jest 30** (unit + e2e), **ESLint 9 + Prettier 3** (aspas simples, `trailingComma: all`, configurado em `.prettierrc`).
- **Sem Prisma / banco real ainda** — persistência é um array TypeScript em memória dentro de `UsersService`, recriado a cada restart do processo.

## Estrutura de pastas atual

```text
src/
├── app.module.ts          # módulo raiz
├── app.controller.ts       # GET / — boilerplate do Nest, sem relação com o domínio
├── app.service.ts
├── main.ts                 # bootstrap
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   └── user.service.ts     # nome do arquivo no singular — a classe é UsersService (plural)
└── auth/
    ├── auth.module.ts
    ├── auth.controller.ts
    ├── auth.service.ts
    ├── jwt.strategy.ts
    ├── jwt-auth.guard.ts
    ├── dto/
    │   └── login.dto.ts
    ├── auth.controller.spec.ts   # stub do nest g, não preenchido
    └── auth.service.spec.ts      # stub do nest g, não preenchido
```

## Módulos e responsabilidades

**`AppModule`** (`src/app.module.ts`) — registra `ConfigModule.forRoot({ isGlobal: true })` (lê o `.env` uma vez, disponível em qualquer módulo via `ConfigService`), e importa `AuthModule` e `UsersModule`.

**`UsersModule` / `UsersService`** (`src/users/user.service.ts`) — guarda um array **em memória** com dois usuários seed: `Ana` (`ana@devconnect.com`) e `Carlos` (`carlos@devconnect.com`), ambos com senha `123456` já hasheada via `bcrypt.hashSync` no momento em que a classe é instanciada. `findALL()` remove o campo `password` de cada usuário antes de devolver (desestruturação `{ password, ...rest }`). `findByEmail(email)` devolve o usuário **completo**, incluindo o hash da senha — é de uso interno, consumido pelo `AuthService` para comparar a senha digitada no login.

**`UsersController`** (`src/users/users.controller.ts`) — `GET /users`, **sem guard**, público. Lista os usuários (sem senha) via `usersService.findALL()`.

**`AuthModule`** (`src/auth/auth.module.ts`) — importa `UsersModule` (para injetar `UsersService` dentro do `AuthService`), `PassportModule`, e registra `JwtModule.registerAsync({...})` lendo `JWT_SECRET` e `JWT_EXPIRES_IN` via `ConfigService` (injeção assíncrona, não lê `process.env` direto).

**`AuthService`** (`src/auth/auth.service.ts`) — duas responsabilidades: `validateUser(email, password)` busca o usuário por e-mail e compara a senha com `bcrypt.compare`, devolvendo o usuário sem a senha (ou `null` se e-mail não existe ou senha não bate); `login(loginDto)` chama `validateUser`, lança `UnauthorizedException('Credenciais inválidas')` se falhar, e senão monta o payload `{ sub: user.id, email: user.email }` e assina o token com `jwtService.signAsync(payload)`.

**`AuthController`** (`src/auth/auth.controller.ts`) — `@Controller()` **sem prefixo**; as rotas declaram o caminho completo no próprio decorator: `@Post('auth/login')` e `@Get('profile')` — ou seja, `/profile` fica **fora** de qualquer prefixo `/auth`, apesar do nome do arquivo. `login()` delega pro `AuthService.login()`. `profile()` é protegida por `@UseGuards(JwtAuthGuard)` e só devolve `req.user`.

**`JwtStrategy`** (`src/auth/jwt.strategy.ts`) — extrai o token do header `Authorization: Bearer <token>` (`ExtractJwt.fromAuthHeaderAsBearerToken()`), valida contra `JWT_SECRET` (via `ConfigService`, injetado no construtor) e rejeita token expirado (`ignoreExpiration: false`). `validate(payload)` roda só depois da assinatura já verificada, e devolve `{ id: payload.sub, email: payload.email }`, que vira `req.user`.

**`JwtAuthGuard`** (`src/auth/jwt-auth.guard.ts`) — casca fina: `extends AuthGuard('jwt')`, aplicada com `@UseGuards(JwtAuthGuard)` em qualquer rota que deva exigir token.

**`LoginDto`** (`src/auth/dto/login.dto.ts`) — valida `email` (`@IsEmail()`) e `password` (`@IsString()`, `@IsNotEmpty()`). Aplicado automaticamente pelo `ValidationPipe` global registrado em `main.ts`.

## Fluxo de autenticação

```text
Login:
  POST /auth/login
    → AuthController.login(loginDto)
    → AuthService.login(loginDto)
        → AuthService.validateUser(email, password)
            → UsersService.findByEmail(email)
            → bcrypt.compare(password, user.password)
        → monta payload { sub: user.id, email: user.email }
        → jwtService.signAsync(payload)
        → responde { access_token }   ← nome de campo com typo, ver Seção 9

Rota protegida:
  GET /profile
    → JwtAuthGuard (AuthGuard('jwt'))
        → dispara a JwtStrategy do Passport
        → extrai o token do header Authorization: Bearer <token>
        → verifica assinatura e expiração contra JWT_SECRET
        → JwtStrategy.validate(payload) → { id, email }
    → vira req.user, devolvido direto pelo controller
```

## Variáveis de ambiente

O `.env` na raiz do projeto define hoje:

| Chave | Observação |
|---|---|
| `JWT_SECRET` | usada para assinar e verificar o token (`auth.module.ts` e `jwt.strategy.ts`, ambos via `ConfigService`). |
| `JWR_EXPIRES_IN` | **nome com typo** — o código lê `JWT_EXPIRES_IN` (com T), então essa chave nunca é encontrada e a expiração sempre cai no fallback hardcoded `'30s'`. Ver Seção 9. |

Não existe `.env.example` no repositório.

## Endpoints atuais

| Método | Rota | Guard | Body | Resposta |
|---|---|---|---|---|
| GET | `/` | — | — | `"Hello World!"` (boilerplate do Nest) |
| GET | `/users` | nenhum (público) | — | array de usuários, sem o campo `password` |
| POST | `/auth/login` | — | `{ email, password }` | `{ access_token }` (200) ou `401 Unauthorized` |
| GET | `/profile` | `JwtAuthGuard` | — (precisa de `Authorization: Bearer <token>`) | `{ id, email }` |

## Problemas conhecidos / pendências

Documentado de propósito — é o que a próxima IA/desenvolvedor precisa saber antes de mexer no código. Nenhum destes itens foi corrigido nesta tarefa.

- **Dependências usadas no código mas ausentes de `package.json`/`node_modules`: `bcryptjs`, `class-validator`, `class-transformer`.** O projeto não builda nem sobe sem instalar essas três antes (`npm install bcryptjs class-validator class-transformer`).
- **`.env` tem `JWR_EXPIRES_IN` em vez de `JWT_EXPIRES_IN`** (typo na letra R/T) — o `configService.get('JWT_EXPIRES_IN')` nunca encontra a chave, e a expiração do token sempre cai no fallback `'30s'` definido em `auth.module.ts`.
- **A resposta do login devolve `access_token`** (falta um "c") em vez de `access_token` — qualquer cliente/frontend que espere o nome padrão vai quebrar até isso ser corrigido ou documentado no consumidor.
- **Sem banco real** — `UsersService` guarda os usuários num array em memória; tudo é perdido a cada restart do processo. Prisma/Postgres estão planejados mas ainda não presentes neste repositório.
- **`auth.controller.spec.ts` e `auth.service.spec.ts` são stubs do `nest g` não preenchidos** — não injetam as dependências reais (`UsersService`, `JwtService` etc.), então tendem a falhar se rodados como estão hoje.
- **Inconsistências de nomenclatura**: o arquivo é `user.service.ts` (singular) mas a classe é `UsersService` (plural); `auth.service.ts` importa `UsersService` via `'src/users/user.service'` (caminho absoluto a partir da raiz, funciona porque `tsconfig.json` tem `baseUrl: "./"`) enquanto o resto do projeto usa import relativo — não é um bug (compila e resolve normalmente), mas é um estilo isolado dentro do projeto.
- **`GET /users` é público, `GET /profile` exige JWT** — pode ser proposital (listar usuários não é sensível, ver perfil é), mas vale confirmar com o enunciado do desafio se era essa a intenção.
- **Sem endpoint de cadastro (`POST /users`)** — os únicos dois usuários existentes são os seeds hardcoded em `UsersService`; não há como criar um novo usuário via API.
- **Sem refresh token e sem logout** — o único jeito de "sair" é o cliente descartar o token guardado; ele continua válido até expirar.

## Como rodar

```bash
# 1. instalar as dependências existentes no package.json
npm install

# 2. instalar as três dependências que o código usa mas não estão declaradas
npm install bcryptjs class-validator class-transformer

# 3. conferir o .env na raiz — hoje ele tem JWR_EXPIRES_IN (typo);
#    o app roda mesmo assim (cai no fallback '30s'), mas se quiser
#    que JWT_EXPIRES_IN funcione de verdade, corrija o nome da chave

# 4. subir em modo desenvolvimento
npm run start:dev
```

A API sobe na porta de `process.env.PORT`, com fallback `3000` (`src/main.ts`).

## Convenções observadas

- Nomes de variáveis em português misturados com inglês no meio do código em TypeScript (`senhaValida`, `resto`, `_senha`) — reflexo do estágio de aprendizado, não uma convenção formal do projeto.
- `.prettierrc` exige aspas simples (`singleQuote: true`) e vírgula final em tudo (`trailingComma: "all"`) — nem todo arquivo do repositório segue isso hoje (alguns usam aspas duplas nos imports).
- Estrutura gerada e mantida via Nest CLI padrão (`nest g module` / `service` / `controller`), sem customização de schematics.
