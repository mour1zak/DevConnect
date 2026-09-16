// Popula Role, Permission e RolePermission.
// Sem isto: POST /users (cadastro) quebra com 500 ("Role padrão não configurada"), porque
// UsersService.create() busca a role "USER" no banco; e toda rota com @Permissions(...) nega
// acesso a todo mundo (inclusive ADMIN), porque request.user.permissions vem sempre vazio.
//
// Rodar com: npx prisma db seed  (config já existe em prisma7.config.ts)
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Espelha src/auth/enums/permission.enum.ts — se um valor for adicionado/removido lá,
// atualizar aqui também (não há geração automática a partir do enum).
const PERMISSIONS: { code: string; description: string }[] = [
  { code: 'POST_CREATE', description: 'Criar posts' },
  { code: 'POST_UPDATE_OWN', description: 'Editar o próprio post' },
  { code: 'POST_UPDATE_ANY', description: 'Editar qualquer post (moderação)' },
  { code: 'POST_DELETE_OWN', description: 'Excluir o próprio post' },
  { code: 'POST_DELETE_ANY', description: 'Excluir qualquer post (moderação)' },

  { code: 'COMMENT_CREATE', description: 'Criar comentário' },
  { code: 'COMMENT_UPDATE_OWN', description: 'Editar o próprio comentário' },
  { code: 'COMMENT_DELETE_OWN', description: 'Excluir o próprio comentário' },
  { code: 'COMMENT_DELETE_ANY', description: 'Excluir qualquer comentário (moderação)' },

  { code: 'REACTION_CREATE', description: 'Criar ou trocar reação (like/dislike)' },
  { code: 'REACTION_DELETE_OWN', description: 'Excluir a própria reação' },

  { code: 'USER_LIST', description: 'Listar usuários (painel admin)' },
  { code: 'USER_CHANGE_ROLE', description: 'Alterar a role de um usuário' },
  { code: 'USER_VIEW_DETAILS', description: 'Ver detalhes administrativos de um usuário' },

  { code: 'ROLE_PERMISSION_VIEW', description: 'Visualizar roles e permissions' },
  { code: 'ROLE_PERMISSION_UPDATE', description: 'Alterar quais permissions cada role possui' },

  { code: 'EXTERNAL_USERS_VIEW', description: 'Consultar usuários externos (integracao)'},
  { code: 'EXTERNAL_POST_CREATE', description: 'Criar posts externos (integracao)'},
];

const ROLES: { name: string; description: string }[] = [
  { name: 'USER', description: 'Usuário padrão' },
  { name: 'MODERATOR', description: 'Moderador de conteúdo' },
  { name: 'ADMIN', description: 'Administrador' },
];

// Quem tem o quê. ADMIN recebe todas (inclusive ROLE_PERMISSION_VIEW/UPDATE — sem isso,
// ninguém consegue usar o painel de administração de permissões, nem o próprio ADMIN).
const ROLE_PERMISSIONS: Record<string, string[]> = {
  USER: [
    'POST_CREATE',
    'POST_UPDATE_OWN',
    'POST_DELETE_OWN',
    'COMMENT_CREATE',
    'COMMENT_UPDATE_OWN',
    'COMMENT_DELETE_OWN',
    'REACTION_CREATE',
    'REACTION_DELETE_OWN',
    'EXTERNAL_USERS_VIEW',
  ],
  MODERATOR: [
    'POST_CREATE',
    'POST_UPDATE_OWN',
    'POST_DELETE_OWN',
    'POST_DELETE_ANY',
    'COMMENT_CREATE',
    'COMMENT_UPDATE_OWN',
    'COMMENT_DELETE_OWN',
    'COMMENT_DELETE_ANY',
    'REACTION_CREATE',
    'REACTION_DELETE_OWN',
    'EXTERNAL_USERS_VIEW',
    'EXTERNAL_POST_CREATE',
  ],
  ADMIN: PERMISSIONS.map((p) => p.code),
};

async function main() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }

  for (const [roleName, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const permissions = await prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
    });

    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  console.log('Seed concluído: roles, permissions e associações populadas.');
  console.log(
    'Para testar rotas de admin, cadastre um usuário normal e promova-o a ADMIN pelo Prisma Studio (npx prisma studio): tabela User, campo roleId → id da role ADMIN.',
  );
}

main()
  .catch((error) => {
    console.error('Falha ao rodar o seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
