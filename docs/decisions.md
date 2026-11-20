# Decisions

Choices made where DESIGN.md left room, so they can be reviewed. Newest last.

## D1 - Muster lives on its own orphan branch of this repo

The repository's main branch holds a different project (Battle Drill). Muster is on the orphan branch
`claude/keen-dijkstra-dyu9dt`; nothing is shared with the other branch. Moving it to its own private repo
later is a plain `git push` of this branch.

## D2 - Game data is a versioned document store with stable keys

- All game data lives in one table, `game_entity`: typed key columns (`type`, `key`, `faction_key`,
  `parent_key`, `name`, `source`, `data_version_id`) plus the full record as JSONB in `data`. Java
  records in `app.muster.gamedata.model` are the typed view (`Datasheet`, `Weapon`, `Stratagem`...).
- Every entity has a **stable key** derived from normalized names, for example
  `death-guard:plague-marines`, `death-guard:plague-marines:size:10`, `death-guard:det:<name>`. The same
  unit gets the same key from every source and in every data version.
- Rosters and ManualOverrides refer to keys, not row ids. That is what makes "overrides survive
  re-imports", "Update to current data" and the version diff work without id mapping tables.
- DESIGN.md 4 says ManualOverride has "entity type + entity id"; the "id" is the stable key.

## D3 - Imports are kept as parsed source sets; versions are built by merging

- Each import stores its parsed result (gzipped JSON) in `source_import`.
- A data version is built from the newest import of each source: entities are grouped by
  (type, key) and merged field by field with the priorities from DESIGN.md 5.2 (`MergePolicy`).
  Per-field provenance is stored, so the admin editor shows where each value came from.
- Overrides are applied last. `field = "*"` creates or replaces a whole entity: this is how data that
  no import provides (for example battle sizes with DP budgets) is entered in the admin page.
- Editing an override rebuilds the ACTIVE and DRAFT versions in place from their own imports. Archived
  versions never change.

## D4 - Unit sizes come from the highest priority points source that lists the unit

If the MFM lists a unit, its sizes are the truth; a size only BattleScribe or Wahapedia knows is
dropped and reported (`unit-size-dropped`). MFM rows that match no datasheet are reported as
`unmatched` and never silently dropped.

## D5 - Plain keywords get glossary entries without text

Every unit and faction keyword on a datasheet gets a GlossaryEntry (`UNIT_KEYWORD` /
`FACTION_KEYWORD`) with empty text, so every chip can open a popup that says "Unit keyword, no rules of
its own" plus the reverse index. Weapon abilities without a definition get **no** entry: their chip
shows "No definition in the database yet".

## D6 - Army rules and detachment rules are also Abilities

So they get phase tags and show up on the phase cheat sheet, each army rule and detachment rule is
also stored as an `Ability` with owner `ARMY_RULE` / `DETACHMENT`.

## D7 - Library catalogues

BattleScribe library catalogues are not factions. Units a faction imports from a library
(`importRootEntries`) are listed under that faction. A non-library catalogue imported with root entries
becomes the faction's parent (for example a chapter and its parent faction); the chapter sees the
parent's units.
