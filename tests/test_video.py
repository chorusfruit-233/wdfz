"""宣传片：渲染脚本的输出安全、镜头表与镜头脚本 / 配乐一致、不泄露隐藏内容。"""
from pathlib import Path
import json
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT / 'video'
RENDERERS = ('video/render.py', 'video/v1/render.py')     # 新版和存档的第一版都要守住输出目录


class TrailerOutputTest(unittest.TestCase):
    def test_custom_output_does_not_delete_existing_files(self):
        for script in RENDERERS:
            with self.subTest(script=script), tempfile.TemporaryDirectory() as tmp:
                output = Path(tmp) / 'frames'
                output.mkdir()
                keep = output / '00000.jpg'
                keep.write_bytes(b'keep me')
                result = subprocess.run(
                    [sys.executable, script, '--out', str(output)], cwd=ROOT,
                    capture_output=True, text=True, timeout=20,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('自定义输出目录必须为空', result.stderr)
                self.assertEqual(keep.read_bytes(), b'keep me')

    def test_invalid_preview_options_do_not_create_or_clear_output(self):
        for script in RENDERERS:
            with self.subTest(script=script), tempfile.TemporaryDirectory() as tmp:
                output = Path(tmp) / 'frames'
                for option in (('--step', '0'), ('--only', 'missing')):
                    result = subprocess.run(
                        [sys.executable, script, '--out', str(output), *option], cwd=ROOT,
                        capture_output=True, text=True, timeout=20,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(output.exists())

    def test_new_renderer_rejects_bad_job_count(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'frames'
            result = subprocess.run([sys.executable, 'video/render.py', '--out', str(output), '--jobs', '0'],
                                    cwd=ROOT, capture_output=True, text=True, timeout=20)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(output.exists())


class TrailerStoryboardTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sb = json.loads((VIDEO / 'storyboard.json').read_text(encoding='utf-8'))
        cls.shots_js = (VIDEO / 'shots.js').read_text(encoding='utf-8')
        cls.score = (VIDEO / 'score.py').read_text(encoding='utf-8')

    def test_every_shot_has_a_script_and_clips_have_places(self):
        ids = [s['id'] for s in self.sb['shots']]
        self.assertEqual(len(ids), len(set(ids)))
        for sid in ids:
            self.assertRegex(self.shots_js, r'\n  %s:\{setup:function' % re.escape(sid), sid)
        acts = {a['id'] for a in self.sb['acts']}
        for s in self.sb['shots']:
            self.assertIn(s['act'], acts)
            self.assertGreater(s['dur'], 0)
            for clip in s.get('clips', []):
                self.assertRegex(self.shots_js, r'\n  %s:\{at:' % re.escape(clip), clip)
        self.assertLess(sum(s['dur'] for s in self.sb['shots']), 120)

    def test_score_only_cues_existing_shots(self):
        ids = {s['id'] for s in self.sb['shots']}
        cued = set(re.findall(r"(?:at|DUR\[)\(?'([a-z0-9]+)'", self.score))
        self.assertTrue(cued)
        self.assertEqual(cued - ids, set())

    def test_trailer_keeps_hidden_content_out(self):
        """宣传片是公开的：不拍隐藏结局，不出现任何钟点。"""
        text = json.dumps(self.sb, ensure_ascii=False)
        for doc in (text, self.shots_js, (VIDEO / 'README.md').read_text(encoding='utf-8')):
            self.assertNotIn('先辈', doc)
            self.assertNotIn('CUT_DEF.beast', doc)
            self.assertNotIn('隔间', doc)
        self.assertIsNone(re.search(r'\d{1,2}[:：]\d{2}', text), '镜头表里不写钟点')
        self.assertNotRegex(self.shots_js, r"CUT_DEF\[?['.]?beast")


if __name__ == '__main__':
    unittest.main(verbosity=2)
