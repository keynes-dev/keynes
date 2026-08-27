export function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
