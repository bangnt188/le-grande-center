# Next.js trên Vercel

Mini lib gồm access, CRUD/SQL/HTTP handlers, HTTPS client, webhook/inbox và crypto, không có dependency runtime. Target tích hợp đầu tiên: Next.js Route Handlers/Server Actions trên Vercel **Node.js runtime**, Node 22 hoặc bản LTS được dự án/Vercel hỗ trợ. Không cần Redis hay server thường trực. Đây là hướng dẫn tích hợp, chưa có deployment/session/DB thật.

## Build và runtime

Root đã khai báo dependency workspace và `prebuild` build backend trước Next.js. Trên Vercel chọn project root, framework Next.js, build `npm run build`. Giữ package backend trong cùng repo; không cần publish npm. API route sử dụng `export const runtime = 'nodejs'`.

**Dự án hiện vẫn dùng `output: 'export'` để phục vụ GitHub Pages.** Muốn chạy BE trong cùng Next project trên Vercel cần chuyển deployment đó sang Next runtime: bỏ `output: 'export'`, dùng URL domain Vercel cho `NEXT_PUBLIC_SITE_URL`, và bỏ bước `prepare-public-export` trong build runtime. Không dùng artifact Pages cho API/private admin. Nếu giữ Pages public, có thể deploy một backend Next project riêng trên Vercel và giữ core chung; cấu hình auth origin/cookie/CORS theo hai domain trước khi tích hợp.

Core không phụ thuộc Next. Trong app, tạo module `src/server/backend.ts` có `import 'server-only'`, rồi import hai subpath ở đó. Không import module chứa secrets từ Client Component. Auth provider và DB adapter phải xác minh session và tải quyền hiện hành; không dùng fixture hoặc role trong browser.

## Khóa mã hóa

Tạo `FIELD_ACTIVE_KEY_ID` và `FIELD_KEYS_JSON` trong Vercel Environment Variables riêng cho Development/Preview/Production. JSON là map allowlist ID → khóa ngẫu nhiên **32 byte** mã hóa base64; không dùng mật khẩu làm khóa. Không có tiền tố `NEXT_PUBLIC_`, không đặt trong `next.config.env`, commit, log hay response. Preview không được dùng khóa/DB production. Khi đổi biến phải redeploy; các deployment cũ vẫn phải được kiểm soát truy cập.

Ví dụ **module server của ứng dụng**, đọc khóa khi request cần dùng (không sinh khóa lúc cold start):

```ts
import 'server-only';
import { createFieldCipher } from '@shared/backend/crypto';

export function fieldCipher() {
  const activeKeyId = process.env.FIELD_ACTIVE_KEY_ID;
  const source = process.env.FIELD_KEYS_JSON;
  if (!activeKeyId || !source) throw new Error('FIELD_KEY_CONFIG_INVALID');
  let keys: unknown;
  try { keys = JSON.parse(source); }
  catch { throw new Error('FIELD_KEY_CONFIG_INVALID'); }
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
    throw new Error('FIELD_KEY_CONFIG_INVALID');
  }
  return createFieldCipher({
    activeKeyId,
    async getKey(id) {
      if (!Object.hasOwn(keys, id)) throw new Error('FIELD_KEY_CONFIG_INVALID');
      const encoded = (keys as Record<string, unknown>)[id];
      if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) {
        throw new Error('FIELD_KEY_CONFIG_INVALID');
      }
      const raw = Buffer.from(encoded, 'base64');
      if (raw.length !== 32 || raw.toString('base64') !== encoded) {
        throw new Error('FIELD_KEY_CONFIG_INVALID');
      }
      try {
        return await crypto.subtle.importKey('raw', new Uint8Array(raw),
          { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
      } finally { raw.fill(0); }
    },
  });
}
```

Không log exception gốc/config. Cache key import theo deployment được phép; không cache grants/session trong core. Khi dùng KMS/HSM cần adapter phù hợp, không export khóa từ KMS chỉ để khớp interface.

## Lưu và đọc dữ liệu

Sau khi `requireAccess` thành công, resolve context từ DB:

```ts
const context = { tenantId: row.ownerOrganizationId, recordId: row.id, field: 'taxId' };
const cipher = fieldCipher();
const stored = await cipher.encrypt(taxId, context); // persist JSON envelope
const value = await cipher.decrypt(stored, context); // only after access check
```

Context phải lấy từ bản ghi phía server; không tin context trong body. Envelope chứa version, algorithm, keyId, IV ngẫu nhiên và ciphertext kèm authentication tag. Metadata/context không bí mật; AES-GCM phát hiện sửa ciphertext hoặc tráo context, không chống replay phiên bản cũ. Dùng revision/transaction ở DB nếu cần chống rollback. Giới hạn plaintext UTF-8 64 KiB/trường; đây không phải mã hóa file/stream/password.

Luân chuyển: thêm key ID mới → cho các deployment đọc cả cũ/mới → đổi active ID → mã hóa lại dữ liệu theo batch có checkpoint → xác minh backup/restore → mới bỏ key cũ. Quản lý lượng encrypt theo mỗi key và rotation; IV ngẫu nhiên 96 bit không thay thế chính sách giới hạn sử dụng key. Mất key thì không phục hồi được dữ liệu.

## Threat model và giới hạn

Bảo vệ bản sao DB khi attacker không có khóa; scope authorization ngăn đọc chéo tenant nếu adapter/query đúng. Không bảo vệ khỏi BE bị chiếm quyền hoặc tài khoản Vercel có quyền đọc secrets; crypto không cấp quyền truy cập. Kiểm tra quyền trước decrypt, trả DTO tối thiểu, response private dùng `Cache-Control: private, no-store`, ghi audit an toàn. Mutation cần auth + CSRF/Origin + transaction; rate/body limits ở route.

Chưa có provider/DB adapter, RLS hay integration verification trên Vercel. Build thư viện cục bộ không chứng minh hệ thống production đã bảo mật.

Nguồn: [Vercel Node runtime](https://vercel.com/docs/functions/runtimes), [Vercel Environment Variables](https://vercel.com/docs/environment-variables/managing-environment-variables), [Next.js data security](https://nextjs.org/docs/app/guides/data-security), [OWASP cryptographic storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html).

CRUD routes, PostgreSQL query và webhook inbox: [Integration guide](./docs/integration.md). Ví dụ đã typecheck/test: [Customer service](./examples/customers.ts).
