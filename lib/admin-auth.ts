export const adminCookieName = "library_admin_access";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "2026";
}

export function isAdminPassword(password: string) {
  return password === getAdminPassword();
}
