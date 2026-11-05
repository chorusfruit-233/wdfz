"""高画质彩斑条纹排查（《校园直通、翻越受伤与国际交流》第 5 节）：接触阴影只认凹角、逐像素旋转、输出抖动，WebGL 与 WebGPU 两条后处理一致。"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class RenderStripeTest(unittest.TestCase):
    def setUp(self):
        self.gl = (ROOT / 'game3d/js/engine/three.js').read_text(encoding='utf-8')
        self.gpu = (ROOT / 'game3d/js/engine/webgpu-post.js').read_text(encoding='utf-8')

    def test_ao_samples_opposite_pairs_and_only_counts_creases(self):
        for src in (self.gl, self.gpu):
            self.assertRegex(src, r'min\(za,\s*zb\)')          # 两边都更近才算遮挡：平面的深度梯度不再成条纹
            self.assertRegex(src, r'uv\s*-\s*d')               # 成对的反方向取样
            self.assertIn('rot', src)                           # 每像素旋转，取样不排成规则图案
            self.assertNotRegex(src, r'smoothstep\(0\.035,0\.22,dz\)')   # 旧的单边判定已经去掉

    def test_output_is_dithered_independent_of_grain(self):
        self.assertRegex(self.gl, r"outc\+=vec3\(\(hash\(gl_FragCoord\.xy\*1\.37")
        self.assertRegex(self.gpu, r"outc\+=vec3<f32>\(\(schoolHash\(pixel\*1\.37")
        self.assertNotRegex(self.gl, r"1\.37[^\n]*uGrain")   # 抖动不跟颗粒开关走


if __name__ == '__main__':
    unittest.main()
