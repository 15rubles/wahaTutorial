# Data schema

This file has two parts: what Wahapedia actually offers for 11th edition (filled in by the M1 recon,
before any parser is written), and our own normalized schema (filled in during M2).

No schema is assumed until the recon is done. The 10th edition file names in `CLAUDE.md` are a
starting hint only.

## Part 1: Source recon (M1, done 2026-11-17)

### robots.txt

- `User-agent: *` disallows old editions and the underscore mirrors (`/wh40k11ed_/`), not `/wh40k11ed/`.
- Everything we need (`/wh40k11ed/*.csv`, `/wh40k11ed/the-rules/core-rules/`) is allowed.
- Sitemap: `https://wahapedia.ru/wh40k11ed/SiteMap.xml`.

### Data export (yes, an 11th edition export exists)

- Landing page: `https://wahapedia.ru/wh40k11ed/the-rules/data-export/`.
- Spec: `https://wahapedia.ru/wh40k11ed/Export%20Data%20Specs.xlsx` (English and Russian sheets).
- Files: `https://wahapedia.ru/wh40k11ed/<Name>.csv`.
- Format: `|` delimited, UTF-8 **with BOM**, **CRLF** line endings, every line (header too) ends with a trailing `|`.
  Description fields contain HTML using site CSS classes. Booleans are `true` / `false`. IDs are strings
  (zero padded, for example `000000001`), unique per table.
- The server sends `ETag` and `Last-Modified`, so conditional GETs work. Connections are sometimes reset
  mid-request; the client must retry.
- `Last_update.csv` has one row: `last_update` as `YYYY-MM-DD HH:MM:SS`. Drives incremental sync.

| File                            | Fields                                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factions                        | id, name, link                                                                                                                                           |
| Source                          | id, name, type, edition, version, errata_date, errata_link                                                                                               |
| Datasheets                      | id, name, faction_id, source_id, legend, role, loadout, transport, virtual, is_support, leader_head, leader_footer, damaged_w, damaged_description, link |
| Datasheets_abilities            | datasheet_id, line, ability_id, model, name, description, type, parameter                                                                                |
| Datasheets_keywords             | datasheet_id, keyword, model, is_faction_keyword                                                                                                         |
| Datasheets_models               | datasheet_id, line, name, M, T, Sv, inv_sv, inv_sv_descr, W, Ld, OC, base_size, base_size_descr                                                          |
| Datasheets_options              | datasheet_id, line, button, description                                                                                                                  |
| Datasheets_wargear              | datasheet_id, line, line_in_wargear, dice, name, description, range, type, A, BS_WS, S, AP, D                                                            |
| Datasheets_unit_composition     | datasheet_id, line, description                                                                                                                          |
| Datasheets_models_cost          | datasheet_id, line, description, cost                                                                                                                    |
| Datasheets_stratagems           | datasheet_id, stratagem_id                                                                                                                               |
| Datasheets_enhancements         | datasheet_id, enhancement_id                                                                                                                             |
| Datasheets_detachment_abilities | datasheet_id, detachment_ability_id                                                                                                                      |
| Datasheets_leader               | leader_id, attached_id                                                                                                                                   |
| Stratagems                      | id, faction_id, name, type, cp_cost, legend, turn, phase, description, detachment, detachment_id                                                         |
| Abilities                       | id, name, legend, faction_id, description                                                                                                                |
| Enhancements                    | id, faction_id, name, legend, description, cost, detachment, detachment_id, upgrade, support_leader                                                      |
| Enhancements_wargear            | enhancement_id, line, line_in_wargear, dice, name, description, range, type, A, BS_WS, S, AP, D                                                          |
| Detachment_abilities            | id, faction_id, name, legend, description, detachment, detachment_id                                                                                     |
| Detachments                     | id, faction_id, name, legend, type, dp, force_disposition                                                                                                |
| Detachments_chapter_dp          | detachment_id, keyword, dp                                                                                                                               |
| Last_update                     | last_update                                                                                                                                              |

### Differences from the 10th edition export

- New: `Detachments.csv` (with `dp` = detachment points and `force_disposition`, a comma separated list
  such as two named dispositions), `Detachments_chapter_dp.csv` (per chapter keyword dp overrides),
  `Enhancements_wargear.csv` (weapon profiles granted by enhancements).
- New columns: `Datasheets.is_support`, `Enhancements.upgrade`, `Enhancements.support_leader`.
- Stratagems, enhancements and detachment abilities link to a detachment by `detachment_id`.

### Data quirks seen in the real files

- `Datasheets_wargear.type` is `Ranged` or `Melee` (a few rows empty: wargear without a profile).
- Weapon keywords are a comma separated list in `Datasheets_wargear.description`, with inconsistent case
  (`rapid fire 1`, `Rapid Fire 1`, `RAPID FIRE 1`), parameters (`sustained hits d3`, `anti-infantry 4+`)
  and an 11th edition conditional form `KEYWORD: non-X/Y` (for example a hits keyword that only applies
  against targets without some keywords).
- `Datasheets_wargear.name` for combi weapons uses `Profile group - Profile name`.

### Core rules

- One page: `https://wahapedia.ru/wh40k11ed/the-rules/core-rules/` (about 790 KB of HTML).
- Section headings are `h2` / `h3` with an `id` anchor and a `<span class="h_number">05.01</span>`
  dotted section code. The heading level is NOT a reliable hierarchy; the dotted code is.
- Top level sections 01 to 25. `super_header` h2s (for example "BASIC RULES") group them.
- FAQ and Errata are h3s without a code and belong to the section above them.
- Core abilities (weapon keywords) live in section 24 as `div.abName` blocks (`[ANTI]` plus an `h_number`
  like `24.03`) rather than headings.
- Body text uses `span.kwb` for keywords and tooltip spans; ads and scripts must be stripped.

## Part 2: Normalized schema (M2)

Zod schemas live in `packages/data/src/schema.ts` and are exported (with inferred types) from the
browser-safe entry `@battle-drill/data`. Node-only code (sync, build) is in `@battle-drill/data/node`.

`npm run data:build` reads `data-cache/raw/` and writes `data-cache/normalized/`:

| File                                                                                                       | Content                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `meta.json`                                                                                                | schema version, build time, source `last_update`, oldest raw fetch time, fixture flag                                                            |
| `factions.json`                                                                                            | `Faction[]` with datasheet counts                                                                                                                |
| `datasheets/<factionId>.json`                                                                              | `Datasheet[]`: models, weapons, abilities, keywords, composition, costs, options, leader links, stratagem / enhancement / detachment ability ids |
| `catalog.json`                                                                                             | light `CatalogEntry[]` (id, name, faction, role, keywords) for roster matching and pickers                                                       |
| `detachments.json`                                                                                         | `Detachment[]` with detachment points, force dispositions, keyword point overrides, linked ids                                                   |
| `stratagems.json`, `enhancements.json`, `detachment-abilities.json`, `abilities.json`, `publications.json` | one array each                                                                                                                                   |
| `keywords.json`                                                                                            | `Keyword[]`: every unit keyword and weapon keyword with use counts (rule links added in M3)                                                      |
| `_report.json`                                                                                             | counts, errors, warnings (file, line, id, category, message) and an explanation per category                                                     |

Conventions:

- Every entity has `id`, `sourceId` (the Wahapedia id) and `sourceUrl`.
- Fields ending in `Html` are the export HTML as is (GW text, cache only).
- Characteristics are parsed: `movement` (inches or null), `save` / `leadership` / `skill` as the target
  number (3 for 3+), `invuln` or null, `ap` as a non-positive integer, `attacks` / `strength` / `damage`
  as `DiceExpr` `{ dice, sides, plus, raw }` (`D6+1` is `{1, 6, 1}`, a flat 3 is `{0, 0, 3}`).
- `range` is null for melee weapons; `skill` is null when the weapon has no BS / WS (for example
  weapons that hit automatically).
- Weapon keywords are `{ id, param?, target?, condition?, raw }`, for example `anti-infantry 4+` is
  `{ id: 'anti', target: 'infantry', param: '4+' }`.

Report categories (`_report.json` `explanations` repeats these):

| Category                  | Level   | Meaning                                                                  |
| ------------------------- | ------- | ------------------------------------------------------------------------ |
| `missing-file`            | error   | expected CSV not in the raw cache                                        |
| `malformed-record`        | error   | wrong number of fields, record skipped                                   |
| `invalid-row`             | error   | failed schema validation, dropped                                        |
| `orphan-reference`        | warning | child row points at a missing datasheet / enhancement / ability, ignored |
| `wargear-without-profile` | warning | wargear row with no Ranged / Melee type (notes, not weapons)             |
| `unparsed-value`          | warning | characteristic not parseable, safe default used                          |
| `model-without-profile`   | warning | model row without Toughness / Wounds, dropped                            |
| `duplicate-id`            | warning | repeated id, first kept                                                  |

Real build on 2026-11-17: 25 factions, 1485 datasheets, 7488 weapon profiles, 0 errors, 98 warnings
(60 orphan references: rows in child tables for datasheets that are not in `Datasheets.csv`;
38 wargear rows without a profile type).
