# Offline JavaScript analysis dependencies

Used only by `tools/link_modules.cjs`, never loaded by the game. No package installation, network or frontend build is required to check or run the checked-in project.

| Library | Version | License |
| --- | --- | --- |
| Acorn | 8.15.0 | MIT, `ACORN-LICENSE` |
| acorn-walk | 8.3.4 | MIT, `ACORN-WALK-LICENSE` |
| eslint-scope | 8.4.0 | BSD-2-Clause, `ESLINT-SCOPE-LICENSE` |
| estraverse | 5.3.0 | BSD-2-Clause, `ESTRAVERSE-LICENSE` |
| esrecurse | 4.3.0 | BSD-2-Clause, original copyright and conditions in `esrecurse.cjs` |

Files are upstream CommonJS distributions. Local `require` paths were adjusted in `scope.cjs` and `esrecurse.cjs`; the latter uses its fixed package version instead of reading a package manifest. Original copyright notices are retained.
