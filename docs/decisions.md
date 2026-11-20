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

## D8 - 11th edition points: per-copy tiers and pricing contexts

The 11th edition data prices later copies of a datasheet differently ("your 1st to 2nd units cost",
"your 3rd+ unit costs") and some units have separate prices per context (for example a price inside
their own faction's detachment and another as an assigned agent). `UnitSizeOption.tiers` keeps the full
list; `points` is the price of the first copy. The n-th copy of a datasheet in a roster is priced with
the tier that covers n, in roster order. Where a size has pricing contexts, the first context is used when
the unit belongs to the army's own faction lineage and the last one otherwise.

## D9 - Chapters as sub-factions in Wahapedia data

Wahapedia files chapter units under their parent faction. Keywords listed in `Detachments_chapter_dp`
are treated as chapters: a sub-faction is created (parent = the detachment's faction) and units with that
faction keyword are filed under it, which matches BattleScribe's catalogue layout. A key aligner in the
builder also moves any unit found under both a parent and a child faction to the child's key.

## D10 - Battle sizes and construction limits come from the core rules page

The battle size table (points, DP, enhancement limit, unit limit) and the notes around it (Battleline and
Dedicated Transport double the unit limit, Epic Heroes have a unit limit of 1, up to three of the same
Upgrade, a single 3 DP detachment in Incursion) are read from the core rules page into
`BattleSize.limits`. If a note is not found, the limit is absent and the report says so; the validation
rules then skip that check instead of guessing.

## D11 - Other game modes are skipped

Boarding Actions detachments, their enhancements and stratagems are skipped (listed as info in the report).
11th edition "Movement Ability" / "Shooting Ability" rows (normal move, advance move, pile-in move...)
are core rule terms and become glossary entries, not stratagems.

## D12 - Munitorum Field Manual

DESIGN.md asks for a PDF importer. For 11th edition the Munitorum Field Manual appears to be a website
(Wahapedia's source list links mfm.warhammer-community.com), and Wahapedia's export already carries the
same points. The PDF importer is implemented for the classic layout (faction headings, "N models ... X pts"
lines, detachment enhancement lists) and tested with an invented PDF only.

## D13 - Overrides change the active version immediately

A points or text fix made in the admin editor rebuilds the ACTIVE (and DRAFT) versions in place, so
every list on the current data sees it at once. The "points changed since this list was built" banner is
about new imports: a list stays on the version it was built on until its owner presses "Update to current
data". Archived versions never change.

## D14 - Per-copy tiers only travel with their own points

When the MFM (or an override) wins on a unit size's points, tiers from another source are dropped and the
flat price applies to every copy. Mixing one source's first-copy price with another source's later-copy
prices would produce numbers that appear in no source.

## D15 - Roster checks

Structural input errors (unknown unit, size, detachment, enhancement, wargear option, attaching a unit to
itself) are refused with 400. Everything about legality is reported as violations and never blocks an
edit, so a list can be built in any order. Rules and their data-driven limits are listed in
`app.muster.roster.rules`; a limit missing from the data skips the check (sometimes with an INFO
violation) instead of guessing.
