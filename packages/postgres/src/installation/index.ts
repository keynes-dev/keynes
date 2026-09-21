export { parseInstallationConfig } from "../installer/config.ts";
export type { InstallationConfig } from "../installer/config.ts";
export { InstallationError, install } from "../installer/install.ts";
import type { install } from "../installer/install.ts";
export type InstallationOptions = Parameters<typeof install>[0];
export type InstallationResult = Awaited<ReturnType<typeof install>>;
