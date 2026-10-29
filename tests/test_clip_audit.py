"""Geometry reports must identify their scope and reject incomplete scans."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class ClipAuditReportTest(unittest.TestCase):
    def run_audit(self, output, room):
        return subprocess.run(
            [sys.executable, 'tools/clip_audit.py', room, '--out', str(output)],
            cwd=Path(__file__).resolve().parents[1], capture_output=True,
            text=True, timeout=90,
        )

    def test_invalid_room_fails_without_replacing_existing_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'report.json'
            output.write_text('previous report', encoding='utf-8')
            result = self.run_audit(output, 'missing-room')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('未知房间', result.stderr)
            self.assertEqual(output.read_text(encoding='utf-8'), 'previous report')

    def test_empty_partial_scan_still_records_room_and_quality(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'report.json'
            result = self.run_audit(output, 'bell1')
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(output.read_text(encoding='utf-8'))
            self.assertEqual(report['scope']['rooms'], ['bell1'])
            self.assertIn(report['scope']['quality'], (0, 1, 2))
            self.assertEqual(report['issues'], [])
            self.assertEqual(report['counts'], {})
