import subprocess
import sys
import unittest


class GreetingTests(unittest.TestCase):
    def invoke(self, *args):
        return subprocess.run([sys.executable, "greet.py", *args], capture_output=True, text=True)

    def test_one_name(self):
        p = self.invoke("Ada")
        self.assertEqual((p.returncode, p.stdout, p.stderr), (0, "Hello, Ada!\n", ""))

    def test_spaced_name(self):
        p = self.invoke("Ada Lovelace")
        self.assertEqual((p.returncode, p.stdout, p.stderr), (0, "Hello, Ada Lovelace!\n", ""))

    def test_missing_name(self):
        p = self.invoke()
        self.assertEqual((p.returncode, p.stdout, p.stderr), (2, "", "usage: greet.py NAME\n"))

    def test_extra_name(self):
        p = self.invoke("Ada", "Grace")
        self.assertEqual((p.returncode, p.stdout, p.stderr), (2, "", "usage: greet.py NAME\n"))
