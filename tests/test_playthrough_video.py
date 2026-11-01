"""Optional recorder safety/integrity tests; never a replacement for a full run."""
from copy import deepcopy
import gzip
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'video'))
import playthrough
from example import package_example
from capture import game_server


class PlaythroughOutputTest(unittest.TestCase):
    def test_local_server_supports_video_seeking_ranges(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            data = bytes(range(100))
            (folder / 'clip.mp4').write_bytes(data)
            with game_server(folder) as url:
                video_url = url.replace('index.html', 'clip.mp4')
                for header, expected in (('bytes=10-19', data[10:20]), ('bytes=90-', data[90:]), ('bytes=-7', data[-7:])):
                    with urlopen(Request(video_url, headers={'Range': header})) as response:
                        self.assertEqual(response.status, 206)
                        self.assertEqual(response.read(), expected)
                        self.assertEqual(response.headers['Accept-Ranges'], 'bytes')
                with self.assertRaises(HTTPError) as caught:
                    urlopen(Request(video_url, headers={'Range': 'bytes=200-'}))
                self.assertEqual(caught.exception.code, 416)
                with urlopen(video_url) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.read(), data)

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
            for arguments in (['--timeout', '0'], ['--quality', '-1'], ['--route', 'trash']):
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
            run = {'video': result, 'source_commit': 'fixture', 'state': {'seconds': 2, 'ending': 'car', 'talent': 'watch'},
                   'events': [{'kind': 'chapter', 'seconds': .5, 'detail': '测试章节'}]}
            summary = package_example(folder, run)
            self.assertEqual(summary['chapters'][0]['seconds'], 0)
            self.assertEqual(json.loads(gzip.decompress((folder / 'playthrough-run.json.gz').read_bytes())), run)
            self.assertTrue((folder / 'playthrough-poster.jpg').is_file())
            with self.assertRaises(ValueError):
                package_example(folder, run)

    def test_player_rejects_modified_movie(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / 'playthrough.mp4').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'SHA-256'):
                package_example(folder, {'video': {'sha256': '0' * 64}})
            self.assertFalse((folder / 'index.html').exists())

    def test_other_endings_require_their_actual_ordered_route(self):
        base = {'state': {'finished': True, 'dead': False, 'screen': 'end'},
                'runtime_checks': {'devOpen': False, 'godMode': False, 'fastMovement': False,
                                   'searchEnabled': True, 'cutscenesEnabled': True}}
        routes = {
            'face': ({'hacked': True, 'data': True, 'quiz': 3},
                     ['whitelistWritten', 'whitelistSynced', 'whitelistVerified']),
            'portal': ({'diary': True, 'blueprints': ['2', '4', '5'], 'sketch': True, 'portalOpen': True},
                       ['portalDiary', 'blueprint2', 'blueprint4', 'blueprintsComplete', 'portalAssembled'])}
        for route, (progress, milestones) in routes.items():
            result = deepcopy(base)
            result['settings'] = {'route': route}
            result['state'].update(ending=route, progress=progress)
            result['events'] = [{'kind': 'milestone', 'detail': m} for m in milestones]
            result['events'].append({'kind': 'materials', 'detail': ['coil', 'lens', 'vial', 'battery']})
            playthrough.validate_success(result)
            for events in (result['events'][1:], list(reversed(result['events']))):
                wrong = deepcopy(result)
                wrong['events'] = events
                with self.assertRaisesRegex(ValueError, '路线过程'):
                    playthrough.validate_success(wrong)
            wrong = deepcopy(result)
            wrong['state']['ending'] = 'car'
            with self.assertRaises(ValueError):
                playthrough.validate_success(wrong)
            wrong = deepcopy(result)
            wrong['state']['progress'] = {}
            with self.assertRaises(ValueError):
                playthrough.validate_success(wrong)
            if route == 'portal':
                wrong = deepcopy(result)
                wrong['events'].pop()
                with self.assertRaisesRegex(ValueError, '材料'):
                    playthrough.validate_success(wrong)


if __name__ == '__main__':
    unittest.main(verbosity=2)
