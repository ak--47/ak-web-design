# ak-web-design · WONK

AK's personal design system as a Claude Code skill. Same mechanism as
[ak-voice](https://github.com/ak--47/ak-voice): lives in `~/.claude/skills/`,
loads in every session, changes picked up live.

**WONK**: dark-first (`#0f1214`), paper light mode (`#ece4d4`), Space Grotesk +
JetBrains Mono, 1px hairlines, 4px radius, square-wave dividers, five poster
pairs (metathesis by default / glorpla / demogorgon / ancient / flourish),
irregular jitter on live states, validated chart palettes, and a
mandatory easter egg.

- `SKILL.md` — the rules + four modes (reskin / build / audit / demo)
- `assets/` — `wonk-tokens.css` (source of truth), `wonk.css`, `wonk.js`
- `references/` — components catalog, pairs, charts, adapters, easter eggs
- Exotic widgets: VU meter, synth knobs (drive goes to 11), oscilloscope
- `demo/index.html` — every component on one page; serve the repo root:
  `python3 -m http.server 4748` then open `http://localhost:4748/demo/`

Decided by grilling, 2026-09-06/07. Chart palettes machine-validated for CVD
separation and contrast on both grounds.
