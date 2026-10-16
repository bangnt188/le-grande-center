import "server-only";
import { Pool, type PoolClient } from "@neondatabase/serverless";
export type { PoolClient } from "@neondatabase/serverless";
import { assertSessionActive } from "./admin-session";
export type AdminIdentity = { id: string; propertyId: string; role: "administrator" | "editor" | "root"; email: string; verifiedSession?: { issuer: string; subject: string; expiresAt: number } };
import { WorkspaceError } from "./errors";
export { WorkspaceError } from "./errors";
export function getDatabase(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  // Cloudflare sockets belong to one request: never retain a pool across requests.
  return new Pool({ connectionString, max: 4, connectionTimeoutMillis: 15_000 });
}
export async function withTransaction<T>(actorId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getDatabase();let client:PoolClient|undefined;
  try {
    client=await pool.connect();
    await client.query("BEGIN; SET LOCAL ROLE leasing_runtime");
    await client.query("SELECT set_config('app.actor_id',$1,true)", [actorId]);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { if(client)await client.query("ROLLBACK"); } catch { /* Preserve original/uncertain commit error; receipt permits safe retry. */ }
    throw error;
  } finally { client?.release(); await pool.end(); }
}
export async function withAdminTransaction<T>(identity: AdminIdentity, work: (client: PoolClient) => Promise<T>): Promise<T> {
  assertSessionActive(identity);
  return withTransaction(identity.id, async client => {
    const result = await work(client);
    // Fixed local expiry is checked again after long uploads/provider I/O, immediately before commit.
    assertSessionActive(identity);
    return result;
  });
}
async function assertResolvedAdmin(client: PoolClient, identity: AdminIdentity) {
  if (identity.role === "root") {
    const { rows } = await client.query(`SELECT u.id FROM leasing.root_allowlist r JOIN leasing.users u ON u.id=r.user_id
      WHERE u.id=$1 AND r.property_id=$2 AND r.revoked_at IS NULL AND r.deleted_at IS NULL
        AND u.disabled_at IS NULL AND u.deleted_at IS NULL FOR SHARE OF u,r`, [identity.id, identity.propertyId]);
    if (!rows.length) throw new WorkspaceError("Root access revoked", 403);
    return;
  }
  if (identity.role !== "administrator" && identity.role !== "editor") throw new WorkspaceError("Administrator access denied", 403);
  const { rows } = await client.query(`SELECT u.id FROM leasing.users u JOIN leasing.staff_assignments s ON s.user_id=u.id
    JOIN leasing.admin_allowlist a ON a.user_id=u.id AND a.property_id=s.property_id
    WHERE u.id=$1 AND s.property_id=$2 AND s.role_code=$3 AND a.role_code=$3
      AND s.revoked_at IS NULL AND a.revoked_at IS NULL AND u.disabled_at IS NULL
      AND u.deleted_at IS NULL AND s.deleted_at IS NULL AND a.deleted_at IS NULL FOR SHARE OF u,s,a`, [identity.id, identity.propertyId, identity.role]);
  if (!rows.length) throw new WorkspaceError("Administrator access revoked", 403);
}
export async function resolveAdminIdentity(verified: { issuer: string; subject: string; email: string; emailVerified: boolean }): Promise<AdminIdentity | null> {
  if (!verified.emailVerified || !verified.issuer || !verified.subject || verified.subject.length > 255 || verified.issuer.length > 512 || verified.email.length > 254) return null;
  return withTransaction("auth:resolver", async client => {
    const { rows: rootRows } = await client.query(`SELECT r.*,u.auth_issuer,u.auth_subject,u.disabled_at,u.deleted_at AS user_deleted_at,p.id AS property_id
      FROM leasing.root_allowlist r JOIN leasing.properties p ON p.id=r.property_id
      LEFT JOIN leasing.users u ON u.id=r.user_id WHERE lower(r.email)=lower($1) AND r.deleted_at IS NULL FOR UPDATE OF r`, [verified.email]);
    const root = rootRows[0];
    if (root) {
      if (root.revoked_at || root.disabled_at || root.user_deleted_at) return null;
      let id = root.user_id;
      if (id) {
        if (root.auth_issuer !== verified.issuer || root.auth_subject !== verified.subject) return null;
      } else {
        const user = await client.query(`INSERT INTO leasing.users(auth_issuer,auth_subject) VALUES($1,$2) RETURNING id`, [verified.issuer, verified.subject]);
        id = user.rows[0].id;
        await client.query("UPDATE leasing.root_allowlist SET user_id=$1 WHERE property_id=$2 AND email=$3", [id,root.property_id,root.email]);
        await client.query(`INSERT INTO leasing.audit_events(property_id,actor_user_id,action_code,entity_type,entity_id) VALUES($1,$2,'root.bootstrap','user',$2)`, [root.property_id,id]);
      }
      const identity: AdminIdentity = { id, propertyId: root.property_id, email: root.email, role: "root" };
      try { await assertResolvedAdmin(client, identity); } catch (error) { if (error instanceof WorkspaceError) return null; throw error; }
      return identity;
    }
    const { rows } = await client.query(`SELECT a.*,u.auth_issuer,u.auth_subject,u.disabled_at,p.id AS property_id
      FROM leasing.admin_allowlist a JOIN leasing.properties p ON p.id=a.property_id
      LEFT JOIN leasing.users u ON u.id=a.user_id WHERE lower(a.email)=lower($1) AND a.deleted_at IS NULL FOR UPDATE OF a`, [verified.email]);
    const allowed = rows[0];
    if (!allowed || allowed.revoked_at || allowed.disabled_at) return null;
    const role = allowed.role_code as "administrator" | "editor";
    let id = allowed.user_id;
    if (id) {
      if (allowed.auth_issuer !== verified.issuer || allowed.auth_subject !== verified.subject) return null;
    } else {
      const user = await client.query(`INSERT INTO leasing.users(auth_issuer,auth_subject) VALUES($1,$2) RETURNING id`, [verified.issuer, verified.subject]);
      id = user.rows[0].id;
      await client.query("UPDATE leasing.admin_allowlist SET user_id=$1 WHERE property_id=$2 AND email=$3", [id,allowed.property_id,allowed.email]);
      await client.query(`INSERT INTO leasing.staff_assignments(property_id,user_id,role_code) VALUES($1,$2,$3)`, [allowed.property_id,id,role]);
      await client.query(`INSERT INTO leasing.audit_events(property_id,actor_user_id,action_code,entity_type,entity_id,metadata) VALUES($1,$2,'admin.bootstrap','user',$2,$3::jsonb)`, [allowed.property_id,id,JSON.stringify({role})]);
    }
    const identity: AdminIdentity = { id, propertyId: allowed.property_id, email: allowed.email, role };
    try { await assertResolvedAdmin(client, identity); } catch (error) { if (error instanceof WorkspaceError) return null; throw error; }
    return identity;
  });
}
