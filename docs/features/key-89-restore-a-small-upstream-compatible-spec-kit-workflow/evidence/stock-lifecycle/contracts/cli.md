# CLI contract

`python3 greet.py NAME` emits `Hello, NAME!` plus newline to stdout and exits 0.
Any other argument count emits `usage: greet.py NAME` plus newline to stderr,
emits no stdout, and exits 2. A quoted name containing spaces is one argument.
