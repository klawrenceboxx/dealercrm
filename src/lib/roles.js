export function isManagerRole(role) {
  return role === "manager" || role === "admin";
}

export function getRoleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  return "Rep";
}
