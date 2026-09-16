import { Role } from "../enums/role.enum";
import { Permission } from "../enums/permission.enum";
import { ROLE_PERMISSIONS } from "./role-permissions";

export function getRolePermissions(
    role: Role,
): Permission[] {
    return ROLE_PERMISSIONS[role] ?? []
}