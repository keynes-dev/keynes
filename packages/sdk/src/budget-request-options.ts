import { KeynesSdkError } from "./sdk-errors.js";

export function requireNoOptions(options: readonly unknown[]): void {
  if (options.length === 0) return;
  throw invalidConfiguration("options");
}

function invalidConfiguration(
  field: string,
): KeynesSdkError<"invalid_configuration"> {
  return new KeynesSdkError("invalid_configuration", {
    field,
    reason: "unsupported",
  });
}
