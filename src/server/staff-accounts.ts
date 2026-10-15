import "server-only";
import { assertAdmin, withTransaction, WorkspaceError, type AdminIdentity } from "./database";

type StaffRole = "administrator" | "editor";
type StaffStatus = "revoked" | "invited" | "active";
function requireAccountManager(identity: AdminIdentity) {
  if (identity.role !== "root" && identity.role !== "administrator") throw new WorkspaceError("Chỉ quản trị viên mới được quản lý tài khoản.", 403);
}
function normalizedEmail(value: unknown): string {
  if (typeof value !== "string") throw new WorkspaceError("Email không hợp lệ.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new WorkspaceError("Nhập email hợp lệ.");
  return email;
}
export async function listStaffAccounts(identity: AdminIdentity) {
  requireAccountManager(identity);
  return withTransaction(identity.id, async client => {
    await assertAdmin(client, identity);
    const { rows } = await client.query(`SELECT a.id,a.email,a.role_code AS role,
      CASE WHEN a.revoked_at IS NOT NULL THEN 'revoked'
           WHEN a.user_id IS NULL THEN 'invited' ELSE 'active' END AS status
      FROM leasing.admin_allowlist a
      WHERE a.property_id=$1 AND a.deleted_at IS NULL
      ORDER BY a.email`, [identity.propertyId]);
    return rows as { id: string; email: string; role: StaffRole; status: StaffStatus }[];
  });
}
export async function saveStaffAccount(identity: AdminIdentity, emailValue: unknown, roleValue: unknown) {
  requireAccountManager(identity);
  const email = normalizedEmail(emailValue);
  if (email === "root@legrandecentre.vn") throw new WorkspaceError("Không thể thêm hoặc đổi tài khoản root tại đây.", 403);
  if (roleValue !== "administrator" && roleValue !== "editor") throw new WorkspaceError("Chọn vai trò Admin hoặc Editor.");
  const role = roleValue as StaffRole;
  return withTransaction(identity.id, async client => {
    await assertAdmin(client, identity);
    await client.query("SELECT id FROM leasing.properties WHERE id=$1 FOR UPDATE", [identity.propertyId]);
    if ((await client.query("SELECT 1 FROM leasing.root_allowlist WHERE property_id=$1 AND lower(email)=$2 AND deleted_at IS NULL", [identity.propertyId,email])).rows.length) throw new WorkspaceError("Tài khoản root không thể được quản lý trong danh sách nhân viên.", 409);
    const result = await client.query(`INSERT INTO leasing.admin_allowlist(property_id,email,role_code)
      VALUES($1,$2,$3) ON CONFLICT(property_id,email) DO UPDATE SET role_code=EXCLUDED.role_code,revoked_at=NULL,deleted_at=NULL
      RETURNING id,user_id`, [identity.propertyId,email,role]);
    const { id: accountId, user_id: userId } = result.rows[0] as { id: string; user_id: string | null };
    if (userId) {
      await client.query(`UPDATE leasing.staff_assignments SET revoked_at=now()
        WHERE property_id=$1 AND user_id=$2 AND role_code IN ('administrator','editor') AND role_code<>$3 AND revoked_at IS NULL`, [identity.propertyId,userId,role]);
      await client.query(`INSERT INTO leasing.staff_assignments(property_id,user_id,role_code)
        VALUES($1,$2,$3) ON CONFLICT(property_id,user_id,role_code) DO UPDATE SET revoked_at=NULL,deleted_at=NULL`, [identity.propertyId,userId,role]);
    }
    await client.query(`INSERT INTO leasing.audit_events(property_id,actor_user_id,action_code,entity_type,entity_id,metadata)
      VALUES($1,$2,'staff.account.save','staff_account',$3,$4::jsonb)`, [identity.propertyId,identity.id,accountId,JSON.stringify({role,linked:!!userId})]);
    return { id: accountId, email, role, status: userId ? "active" as const : "invited" as const };
  });
}
export async function revokeStaffAccount(identity: AdminIdentity, emailValue: unknown) {
  requireAccountManager(identity);
  const email = normalizedEmail(emailValue);
  return withTransaction(identity.id, async client => {
    await assertAdmin(client, identity);
    const result = await client.query(`UPDATE leasing.admin_allowlist SET revoked_at=now()
      WHERE property_id=$1 AND email=$2 AND deleted_at IS NULL AND revoked_at IS NULL RETURNING id,user_id`, [identity.propertyId,email]);
    if (!result.rowCount) throw new WorkspaceError("Không tìm thấy tài khoản đang hoạt động.", 404);
    const { id: accountId, user_id: userId } = result.rows[0] as { id: string; user_id: string | null };
    if (userId) await client.query(`UPDATE leasing.staff_assignments SET revoked_at=now()
      WHERE property_id=$1 AND user_id=$2 AND role_code IN ('administrator','editor') AND revoked_at IS NULL`, [identity.propertyId,userId]);
    await client.query(`INSERT INTO leasing.audit_events(property_id,actor_user_id,action_code,entity_type,entity_id)
      VALUES($1,$2,'staff.account.revoke','staff_account',$3)`, [identity.propertyId,identity.id,accountId]);
  });
}
