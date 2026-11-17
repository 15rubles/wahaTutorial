# Data schema

This file has two parts: what Wahapedia actually offers for 11th edition (filled in by the M1 recon,
before any parser is written), and our own normalized schema (filled in during M2).

No schema is assumed until the recon is done. The 10th edition file names in `CLAUDE.md` are a
starting hint only.

## Part 1: Source recon (M1, not started)

Questions the recon must answer:

- Does an 11th edition data export exist? URL, format, delimiter, encoding.
- Real file names and columns, with a note on how they differ from the 10th edition export.
- How IDs link entities (faction, datasheet, model, wargear, ability, keyword, stratagem, detachment, enhancement).
- Is there a last-update file usable for incremental sync?
- Which core rules pages exist, and what their HTML structure looks like (heading levels, anchors).
- What `robots.txt` allows and disallows.
- Does the server send `ETag` / `Last-Modified`?

## Part 2: Normalized schema (M2, not started)

Zod schemas in `packages/data/src/schema.ts`. Every entity keeps `sourceId` and `sourceUrl`.
