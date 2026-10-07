/** Contract example only. Solar's schema/gallery/lifecycle adapter lives in src/server/catalog.ts. */
import { createCrud, objectInput, textInput, type CrudOptions, type CrudRow } from '@shared/backend';
export type SolarProjectForm = {
  title: string; slug: string; summary: string; content: string; category: string; location: string; system: string;
};
export type SolarProjectRow = CrudRow & SolarProjectForm & { status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' };
export type SolarProjectDTO = SolarProjectForm & { id: string; version: number; status: SolarProjectRow['status'] };
const limits = { title: 200, slug: 160, summary: 1000, content: 20000, category: 100, location: 300, system: 150 } as const;
function parse(input: unknown): SolarProjectForm {
  const data = objectInput(input, Object.keys(limits));
  const slug = textInput(data.slug, { maxLength: 160 });
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid slug');
  return { title: textInput(data.title, { maxLength: limits.title }), slug,
    summary: textInput(data.summary, { minLength: 0, maxLength: limits.summary }),
    content: textInput(data.content, { minLength: 0, maxLength: limits.content }),
    category: textInput(data.category, { maxLength: limits.category }), location: textInput(data.location, { maxLength: limits.location }), system: textInput(data.system, { maxLength: limits.system }) };
}
/** Repository handles tombstones; publish/media/assignments remain application-owned. */
export function createSolarProjects(transaction: CrudOptions<SolarProjectRow, SolarProjectForm, SolarProjectForm, SolarProjectDTO>['transaction']) {
  return createCrud<SolarProjectRow, SolarProjectForm, SolarProjectForm, SolarProjectDTO>({
    type: 'projects', transaction, parseCreate: parse, parseUpdate: parse,
    project: row => ({ id: row.id, version: row.version, status: row.status, title: row.title, slug: row.slug, summary: row.summary, content: row.content, category: row.category, location: row.location, system: row.system }),
  });
}
