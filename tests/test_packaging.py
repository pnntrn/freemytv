"""Offline checks for actual distributable content and configuration boundaries."""
import json
import re
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import webapp


class PackagingTests(unittest.TestCase):
    def test_generic_build_does_not_embed_local_credentials(self):
        files = webapp.files(dict(webapp.GENERIC), 'test')
        config = json.loads(files['config.js'].decode().split('window.CONFIG = ', 1)[1].rstrip(';\n'))
        self.assertEqual(config['tmdbKey'], '')
        self.assertFalse(any(name.endswith(('.properties', '.keystore')) for name in files))

    def test_config_preserves_non_ascii_and_rejects_invalid_coordinates(self):
        with tempfile.TemporaryDirectory() as folder:
            config = Path(folder) / 'test.properties'
            config.write_text('city=เมืองสุรินทร์\nlatitude=14.8818\nlongitude=103.4936\n', encoding='utf-8')
            self.assertEqual(webapp.read_config(str(config))['city'], 'เมืองสุรินทร์')
            config.write_text('latitude=invalid\n', encoding='utf-8')
            with self.assertRaises(SystemExit):
                webapp.read_config(str(config))

    def test_tizen_package_has_valid_manifest_and_required_assets(self):
        subprocess.run([sys.executable, str(ROOT / 'tizen/build.py'), '--generic'], check=True, cwd=ROOT)
        with zipfile.ZipFile(ROOT / 'FreeMyTV-tizen.wgt') as package:
            self.assertIsNone(package.testzip())
            manifest = ET.fromstring(package.read('config.xml'))
            ns = {'w': 'http://www.w3.org/ns/widgets'}
            entry = manifest.find('w:content', ns).attrib['src']
            self.assertIn(entry, package.namelist())
            self.assertIn('fonts/InterVariable.ttf', package.namelist())
            self.assertIn('fonts/OFL.txt', package.namelist())
            self.assertNotIn('author-signature.xml', package.namelist())

    def test_shared_thai_covers_existing_static_android_copy(self):
        words = json.loads((ROOT / "shared/th.json").read_text())
        source = (ROOT / "app/src/io/freemytv/Spanish.java").read_text()
        keys = [json.loads(key) for key in re.findall(r'case ("(?:[^"\\\\]|\\\\.)*"):', source)]
        self.assertTrue(keys)
        self.assertEqual([key for key in keys if key not in words], [])
        assets = webapp.files(dict(webapp.GENERIC), "test")
        self.assertIn("thai.js", assets)
        self.assertIn("fonts/Sarabun-OFL.txt", assets)

    def test_tizenbrew_archive_matches_entrypoint(self):
        subprocess.run([sys.executable, str(ROOT / "tizen/module.py")], check=True, cwd=ROOT)
        with zipfile.ZipFile(ROOT / "FreeMyTV-tizenbrew.zip") as package:
            self.assertIsNone(package.testzip())
            metadata = json.loads(package.read("package.json"))
            self.assertEqual(metadata["packageType"], "app")
            self.assertIn(metadata["appPath"], package.namelist())
            self.assertIn("app/cctv.js", package.namelist())
            self.assertNotIn(b"password", package.read("app/config.js"))

    def test_original_mit_notice_preserved(self):
        license_text = (ROOT / 'LICENSE').read_text()
        self.assertIn('MIT License', license_text)
        self.assertIn('Permission is hereby granted', license_text)
        self.assertIn('copyright notice', license_text)


if __name__ == '__main__':
    unittest.main()
