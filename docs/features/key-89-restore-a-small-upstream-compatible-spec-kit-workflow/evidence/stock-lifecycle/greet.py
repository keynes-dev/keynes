import sys


def main(args):
    if len(args) != 1:
        print("usage: greet.py NAME", file=sys.stderr)
        return 2
    print(f"Hello, {args[0]}!")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
