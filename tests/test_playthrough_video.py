"""Optional recorder safety/integrity tests; never a replacement for a full run."""
from copy import deepcopy
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'video'))
import playthrough


class PlaythroughOutputTest(unittest.TestCase):
    def test_rejects_nonempty_or_linked_output_without_touching_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / 'keep'
            folder.mkdir()
            protected = folder / 'playthrough.mp4'
            protected.write_bytes(b'existing video')
            alias = Path(tmp) / 'alias'
            alias.symlink_to(folder, target_is_directory=True)
            for output in (folder, alias):
                proc = subprocess.run([sys.executable, 'video/playthrough.py', '--out', str(output)],
                                      cwd=ROOT, capture_output=True, text=True, timeout=20)
                self.assertNotEqual(proc.returncode, 0)
                self.assertIn('输出目录必须', proc.stderr)
                self.assertEqual(protected.read_bytes(), b'existing video')

    def test_invalid_options_do_not_create_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'new'
            for arguments in (['--timeout', '0'], ['--quality', '-1']):
                proc = subprocess.run([sys.executable, 'video/playthrough.py', '--out', str(output), *arguments],
                                      cwd=ROOT, capture_output=True, text=True, timeout=20)
                self.assertNotEqual(proc.returncode, 0)
                self.assertFalse(output.exists())

    def test_success_requires_real_ending_driving_and_disabled_debug(self):
        # Deliberately small fixtures for the publication gate, not game snapshots.
        result = {'state': {'finished': True, 'failed': None, 'dead': False, 'screen': 'end', 'ending': 'car'},
                  'runtime_checks': {'devOpen': False, 'godMode': False, 'fastMovement': False,
                                     'searchEnabled': True, 'cutscenesEnabled': True},
                  'observations': [{'chase': {'distance': 260}}], 'page_errors': []}
        playthrough.validate_success(result)
        for group, key, value in (('state', 'ending', 'trash'), ('state', 'dead', True),
                                  ('state', 'finished', False), ('runtime_checks', 'godMode', True),
                                  ('runtime_checks', 'searchEnabled', False)):
            wrong = deepcopy(result)
            wrong[group][key] = value
            with self.assertRaises(ValueError):
                playthrough.validate_success(wrong)
        for field, value in (('observations', []), ('page_errors', ['ReferenceError']), ('error', 'timeout')):
            wrong = deepcopy(result)
            wrong[field] = value
            with self.assertRaises(ValueError):
                playthrough.validate_success(wrong)

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'requires ffmpeg')
    def test_mux_preserves_full_duration_and_has_audio_and_video(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            # Only an encoder fixture; the shipped example must use captured game audio.
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=s=64x64:r=25:d=3',
                            '-c:v', 'libvpx', str(folder / 'gameplay.webm')], check=True)
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
                            '-c:a', 'libopus', '-live', '1', str(folder / 'game-audio.webm')], check=True)
            result = playthrough.encode(folder, {'tail_seconds': .1})
            self.assertAlmostEqual(result['duration'], 3, delta=.1)
            self.assertGreater(result['audio_delay_seconds'], .7)
            self.assertEqual({s['codec_type'] for s in result['streams']}, {'video', 'audio'})
            self.assertEqual(len(result['sha256']), 64)


if __name__ == '__main__':
    unittest.main(verbosity=2)
