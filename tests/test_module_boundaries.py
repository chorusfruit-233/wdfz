"""架构约束随完整回归执行，避免新功能重新跨层写入。"""
from pathlib import Path
import runpy
import unittest


class ModuleBoundariesTest(unittest.TestCase):
    def test_runtime_modules_respect_declared_boundaries(self):
        check = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'tools/check_modules.py'))['check']
        self.assertEqual(check(), [])
