const transport = new URL("./local-database-transport.mjs", import.meta.url).href;

export function resolve(specifier, context, nextResolve) {
  if (specifier === "@neondatabase/serverless") return { url: transport, shortCircuit: true };
  return nextResolve(specifier, context);
}
