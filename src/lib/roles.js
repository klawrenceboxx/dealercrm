const MANAGER_ROLES = ["manager", "admin"];
const ELEVATED_ROLES = ["manager", "admin", "owner"];

export function isManagerRole(role) {
  return MANAGER_ROLES.includes(role);
}

export function isOwnerRole(role) {
  return role === "owner";
}

export function isManagerAdminOrOwner(role) {
  return ELEVATED_ROLES.includes(role);
}

export function getRoleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  return "Rep";
}
