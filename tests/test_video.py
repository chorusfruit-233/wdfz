"""Safety checks for the optional trailer renderer's output directory."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class TrailerOutputTest(unittest.TestCase):
    def test_custom_output_does_not_delete_existing_files(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'frames'
            output.mkdir()
            keep = output / '00000.jpg'
            keep.write_bytes(b'keep me')
            result = subprocess.run(
                [sys.executable, 'video/render.py', '--out', str(output)], cwd=root,
                capture_output=True, text=True, timeout=20,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('自定义输出目录必须为空', result.stderr)
            self.assertEqual(keep.read_bytes(), b'keep me')

    def test_invalid_preview_options_do_not_create_or_clear_output(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'frames'
            for option in (('--step', '0'), ('--only', 'missing')):
                result = subprocess.run(
                    [sys.executable, 'video/render.py', '--out', str(output), *option], cwd=root,
                    capture_output=True, text=True, timeout=20,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
