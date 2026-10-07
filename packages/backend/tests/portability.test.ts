import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAccess, type AccessContext, type AccessResource } from '../src/index.ts';
const now = 1800000000000;
test('Solar project grants cannot access another project or a broad collection', () => {
  const context: AccessContext = { sessionExpiresAt: now + 10000, principal: {
    actorId: 'staff', issuer: 'solar', subject: 'staff', disabled: false, policyVersion: '1',
    grants: [{ permission: 'projects:view', effect: 'allow', scope: { tenantId: 'solar', dimensions: { projectId: 'roof-1' } } }],
  } };
  const resource: AccessResource = { tenantId: 'solar', dimensions: { projectId: 'roof-1' }, type: 'projects', kind: 'collection' };
  assert.equal(evaluateAccess(context, 'projects:view', resource, now).allowed, true);
  assert.equal(evaluateAccess(context, 'projects:view', { ...resource, dimensions: { projectId: 'roof-2' } }, now).allowed, false);
  assert.equal(evaluateAccess(context, 'projects:view', { ...resource, dimensions: undefined }, now).allowed, false);
});

test('custom denies remain conservative when resource facts are missing; unknown flat scope is rejected', () => {
  const context: AccessContext = { sessionExpiresAt: now + 10000, principal: {
    actorId: 'staff', issuer: 'solar', subject: 'staff', disabled: false, policyVersion: '1',
    grants: [
      { permission: 'projects:view', effect: 'allow', scope: { tenantId: 'solar' } },
      { permission: 'projects:view', effect: 'deny', scope: { tenantId: 'solar', dimensions: { projectId: 'private' } } },
    ],
  } };
  const resource: AccessResource = { tenantId: 'solar', type: 'projects', kind: 'collection' };
  assert.equal(evaluateAccess(context, 'projects:view', resource, now).reason, 'explicit-deny');
  const invalid = JSON.parse(JSON.stringify(context)) as AccessContext;
  Object.assign(invalid.principal.grants[0]!.scope, { projectId: 'silently-ignored' });
  assert.equal(evaluateAccess(invalid, 'projects:view', resource, now).reason, 'invalid-context');
});

test('SQL adapter requires and parameterizes Solar dimensions, refusing missing or unknown filters', async () => {
  const { createPostgresRepository } = await import('../src/index.ts');
  const calls: unknown[] = [];
  const repository = createPostgresRepository({
    table: 'projects', columns: { name: 'name' }, scopeColumns: { tenantId: 'tenant_id' },
    dimensionColumns: { projectId: 'project_id' },
    decode: () => ({ id: 'one', version: 1, tenantId: 'solar' }),
    query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; },
  });
  await repository.find('one', { tenantId: 'solar', dimensions: { projectId: 'roof-1' } });
  assert.deepEqual(calls, [{ sql: 'SELECT * FROM "projects" WHERE "tenant_id" = $1 AND "project_id" = $2 AND "id" = $3', values: ['solar', 'roof-1', 'one'] }]);
  await assert.rejects(repository.find('one', { tenantId: 'solar' }), { message: 'INVALID_INPUT' });
  await assert.rejects(repository.find('one', { tenantId: 'solar', dimensions: { siteId: 'other' } }), { message: 'INVALID_INPUT' });
  assert.equal(calls.length, 1);
});

for (const app of ['mall', 'solar'] as const) {
  test(`${app} uses the same CRUD API with application-owned scope and projection`, async () => {
    const { createAccessBackend, createCrud } = await import('../src/index.ts');
    const scope = app === 'mall' ? { tenantId: 'mall', propertyId: 'centre' } : { tenantId: 'solar', dimensions: { projectId: 'roof-1' } };
    type Row = import('../src/index.ts').CrudRow & { name: string };
    let row: Row | null = null;
    const access = createAccessBackend({ now: () => now,
      verifySession: async () => ({ issuer: app, subject: 'staff', expiresAt: now + 10000 }),
      loadPrincipal: async () => ({ actorId: 'staff', issuer: app, subject: 'staff', disabled: false, policyVersion: '1',
        grants: ['view', 'create', 'update', 'delete'].map(action => ({ permission: `records:${action}`, effect: 'allow', scope })) }),
      recordDecision: async () => {},
    });
    const crud = createCrud<Row, { name: string }, { name: string }, { id: string; version: number; name: string }>({
      type: 'records', parseCreate: input => { const value = input as { name: string }; if (typeof value.name !== 'string') throw Error(); return { name: value.name }; },
      parseUpdate: input => ({ name: (input as { name: string }).name }),
      project: value => ({ id: value.id, version: value.version, name: value.name }),
      transaction: async (_request, work) => {
        const snapshot = structuredClone(row);
        try { return await work({ scope, access, repository: {
          find: async () => row, list: async () => ({ items: row ? [row] : [], totalItems: row ? 1 : 0 }),
          insert: async data => (row = { ...data, ...scope, id: 'one', version: 1 }),
          update: async (_id, data, version) => row && row.version === version ? (row = { ...row, ...data, version: version + 1 }) : null,
          delete: async () => { row = null; return true; },
        } }); } catch (error) { row = snapshot; throw error; }
      },
    });
    const request = new Request(`https://${app}.example/api/records`);
    assert.deepEqual(await crud.create(request, { name: 'First' }), { id: 'one', version: 1, name: 'First' });
    assert.equal((await crud.list(request)).totalItems, 1);
    assert.equal((await crud.update(request, 'one', 1, { name: 'Second' })).version, 2);
    await assert.rejects(crud.create(request, { name: 'Injected', dimensions: { projectId: 'other' } }), { message: 'INVALID_INPUT' });
    if (app === 'solar') {
      row!.dimensions = { projectId: 'other' };
      await assert.rejects(crud.get(request, 'one'), { message: 'UNAVAILABLE' });
      row!.dimensions = { projectId: 'roof-1' };
    }
    await crud.delete(request, 'one', 2);
    assert.equal((await crud.list(request)).totalItems, 0);
  });
}
