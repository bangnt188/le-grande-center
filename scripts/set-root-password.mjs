import { hashPassword, verifyPassword } from "@better-auth/utils/password";
import { Pool } from "@neondatabase/serverless";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Script cập nhật mật khẩu cho tài khoản root (hoặc bất kỳ tài khoản nào) trong Neon Auth.
 * Tự động gắn tiền tố PASSWORD_PREFIX từ .env trước khi hash bằng scrypt.
 *
 * Cách sử dụng:
 *   node --env-file=.env.root-admin.local scripts/set-root-password.mjs [email]
 */

const newPassword = process.env.ROOT_ADMIN_PASSWORD;
const email = (process.argv[2]?.trim() || process.env.ROOT_ADMIN_EMAIL || "root@legrandecentre.vn").toLowerCase();

if (!newPassword || newPassword.length < 8) {
  console.error("❌ Lỗi: Vui lòng cung cấp mật khẩu mới (tối thiểu 8 ký tự).");
  console.error("👉 Ví dụ: node --env-file=.env.local scripts/set-root-password.mjs \"MatKhauMoi@2026\"");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Lỗi: DATABASE_URL hoặc DATABASE_URL_UNPOOLED không tồn tại.");
  process.exit(1);
}

const prefix = process.env.PASSWORD_PREFIX ?? process.env.AUTH_PASSWORD_PREFIX ?? "";
const saltedPassword = prefix ? `${prefix}${newPassword}` : newPassword;

console.log(`🔐 Đang hash mật khẩu cho tài khoản: ${email}`);
if (prefix) {
  console.log("✨ Đã áp dụng PASSWORD_PREFIX.");
} else {
  console.log("ℹ️ Không có PASSWORD_PREFIX.");
}

const hash = await hashPassword(saltedPassword);
const verified = await verifyPassword(hash, saltedPassword);
if (!verified) {
  console.error("❌ Lỗi: Không thể xác thực hash scrypt.");
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

try {
  const userResult = await client.query('SELECT id, email FROM neon_auth."user" WHERE lower(email) = lower($1)', [email]);
  if (!userResult.rows.length) {
    console.error(`❌ Lỗi: Không tìm thấy người dùng ${email} trong neon_auth.user.`);
    process.exit(1);
  }

  const userId = userResult.rows[0].id;
  const updateResult = await client.query(
    'UPDATE neon_auth.account SET password = $1, "updatedAt" = now() WHERE "userId" = $2 AND "providerId" = $3',
    [hash, userId, "credential"]
  );

  if (updateResult.rowCount === 0) {
    // Nếu chưa có account credential, tạo mới
    await client.query(
      'INSERT INTO neon_auth.account ("accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, now(), now())',
      [userId, "credential", userId, hash]
    );
  }

  console.log(`✅ Cập nhật mật khẩu trong cơ sở dữ liệu thành công cho ${email}!`);

  // Nếu là root account, đồng bộ file .env.root-admin.local
  if (email === "root@legrandecentre.vn") {
    try {
      const rootEnvPath = resolve(process.cwd(), ".env.root-admin.local");
      const content = `ROOT_ADMIN_EMAIL="${email}"\nROOT_ADMIN_PASSWORD="${newPassword}"\n`;
      await writeFile(rootEnvPath, content, { encoding: "utf8", mode: 0o600 });
      console.log(`📄 Đã lưu mật khẩu mới vào .env.root-admin.local (mode 0600)`);
    } catch {
      // Bỏ qua nếu không ghi được file local
    }
  }

  console.log(`\n🎉 XONG! Bạn có thể đăng nhập ngay với mật khẩu mới.`);
} finally {
  client.release();
  await pool.end();
}
