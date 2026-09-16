import { Role } from "../enums/role.enum";
import { Permission } from "../enums/permission.enum";

export const  ROLE_PERMISSIONS:
Record<Role, Permission[]> = {

    [Role.USER]: [
    Permission.POST_CREATE,
    Permission.POST_UPDATE_OWN,
    Permission.POST_DELETE_OWN,
    Permission.COMMENT_CREATE,
    Permission.COMMENT_DELETE_OWN,
    Permission.REACTION_CREATE,
    Permission.REACTION_DELETE_OWN,
    Permission.COMMENT_UPDATE_OWN,
  ],

  [Role.MODERATOR]: [
    Permission.POST_CREATE,
    Permission.POST_UPDATE_OWN,
    Permission.POST_DELETE_OWN,
    Permission.POST_DELETE_ANY,
    Permission.COMMENT_CREATE,
    Permission.COMMENT_DELETE_OWN,
    Permission.COMMENT_DELETE_ANY,
    Permission.REACTION_CREATE,
    Permission.REACTION_DELETE_OWN,
    Permission.COMMENT_UPDATE_OWN,
  ],

  [Role.ADMIN]: [
    Permission.POST_CREATE,
    Permission.POST_UPDATE_OWN,
    Permission.POST_DELETE_OWN,
    Permission.POST_DELETE_ANY,
    Permission.COMMENT_CREATE,
    Permission.COMMENT_DELETE_OWN,
    Permission.COMMENT_DELETE_ANY,
    Permission.REACTION_CREATE,
    Permission.REACTION_DELETE_OWN,
    Permission.USER_LIST,
    Permission.USER_CHANGE_ROLE,
    Permission.POST_UPDATE_ANY,
    Permission.COMMENT_UPDATE_OWN,
    Permission.USER_VIEW_DETAILS
  ],
};
