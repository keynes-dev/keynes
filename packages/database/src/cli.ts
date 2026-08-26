export function main(): void {
  process.stdout.write(
    "keynes-postgresql: install is not available in this preview\n",
  );
}

if (process.argv[1]?.endsWith("/cli.js")) main();
