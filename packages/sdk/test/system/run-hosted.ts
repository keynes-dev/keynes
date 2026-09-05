const args = process.argv.slice(2);
const options = args[0] === "--" ? args.slice(1) : args;
if (options.length === 1 && options[0] === "--help") {
  process.stdout.write(
    "Hosted acceptance is unavailable. Run without options for the prerequisite reason.\n",
  );
} else if (options.length !== 0) {
  process.stderr.write("Hosted accepts no options except standalone --help.\n");
  process.exitCode = 1;
} else {
  process.stdout.write(
    "NOT RUN: supported Hosted product runner unavailable\n",
  );
  process.exitCode = 1;
}
