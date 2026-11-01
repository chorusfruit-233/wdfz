"""内部检查：玩家 Wiki 不得出现彩蛋结局、彩蛋时刻和相关线索（CLAUDE.md 最高优先级规则）。

只读 wiki/ 下的静态文件，不启动浏览器。清单只放在这个内部测试里，不进玩家页面。"""
from pathlib import Path
import re
import unittest

WIKI = Path(__file__).resolve().parents[1] / 'wiki'
# 隐藏路线的名字、内部 ID、时刻和专属线索
HIDDEN = ['先辈', 'beast', '旧校服', '第三个隔间', '秒针', '慢速窗口']
TIME = re.compile(r'11\s*[:：点]\s*45')


class WikiSecretTest(unittest.TestCase):
    def files(self):
        return [p for p in WIKI.rglob('*') if p.is_file() and p.suffix in ('.html', '.css', '.js', '.json', '.txt', '.md')]

    def test_wiki_has_no_hidden_ending_names_times_or_clues(self):
        files = self.files()
        self.assertTrue(files)
        for path in files:
            text = path.read_text(encoding='utf-8')
            low = text.lower()
            for word in HIDDEN:
                self.assertNotIn(word.lower(), low, f'{path.name} 出现了隐藏内容')
            self.assertIsNone(TIME.search(text), f'{path.name} 出现了隐藏时刻')

    def test_wiki_does_not_count_all_endings(self):
        text = (WIKI / 'index.html').read_text(encoding='utf-8')
        # 不写「共 N 个结局」「全部结局」这类能推出隐藏结局数量的总数
        self.assertIsNone(re.search(r'共\s*[一二三四五六七八九十\d]+\s*(个|条)结局', text))
        self.assertNotIn('全部结局', text)


if __name__ == '__main__':
    unittest.main()
