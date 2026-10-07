/** Application adapter. In Solar use @shared/backend and import 'server-only'. */
import { createCrud, objectInput, textInput, type CrudOptions, type CrudRow } from '@shared/backend';
// Domain fields mirror Solar's catalog; persistence adds technical id/version/scope.
export type SolarProjectForm = {
  title: string; category: string; location: string; description: string; system: string; image: string;
};
export type SolarProjectRow = CrudRow & SolarProjectForm;
export type SolarProjectDTO = SolarProjectForm & { id: string; version: number };
const fields = ['title', 'category', 'location', 'description', 'system', 'image'] as const;
function parse(input: unknown): SolarProjectForm {
  const data = objectInput(input, fields);
  return {
    title: textInput(data.title), category: textInput(data.category), location: textInput(data.location),
    description: textInput(data.description, { maxLength: 10000 }), system: textInput(data.system), image: textInput(data.image, { maxLength: 2048 }),
  };
}
/** Transaction, authoritative assignments, audit, storage, publish rules stay in Solar. */
export function createSolarProjects(transaction: CrudOptions<SolarProjectRow, SolarProjectForm, SolarProjectForm, SolarProjectDTO>['transaction']) {
  return createCrud<SolarProjectRow, SolarProjectForm, SolarProjectForm, SolarProjectDTO>({
    type: 'projects', transaction, parseCreate: parse, parseUpdate: parse,
    project: row => ({ id: row.id, version: row.version, title: row.title, category: row.category,
      location: row.location, description: row.description, system: row.system, image: row.image }),
  });
}
