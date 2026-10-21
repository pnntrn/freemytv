from pathlib import Path
import subprocess
import tempfile
import unittest
import shutil
ROOT = Path(__file__).resolve().parents[1]

class NvrTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("javac"), "JDK compiler unavailable; CI installs JDK 17")
    def test_java_private_network_and_channel_boundaries(self):
        with tempfile.TemporaryDirectory() as out:
            subprocess.run(["javac", "-d", out, str(ROOT / "app/src/io/freemytv/NvrProfile.java"), str(ROOT / "app/src/io/freemytv/NvrLayout.java"),
                            str(ROOT / "tests/java/io/freemytv/NvrProfileTest.java")], check=True)
            subprocess.run(["java", "-cp", out, "io.freemytv.NvrProfileTest"], check=True)
