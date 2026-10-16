import { register } from "node:module";
import { assertOwnedLocalDatabase } from "./local-database-guard.mjs";

assertOwnedLocalDatabase();
register("./local-database-loader.mjs", import.meta.url);
