# Rules questions

Open questions where the cached 11th edition data is ambiguous. Code that depends on one of these
carries a `// RULES-QUESTION: RQ-<n>` comment and runs the simplest interpretation behind a clearly
named flag.

Never answer these from memory or from 10th edition knowledge. Resolve them by reading the cached
rules, then record the resolution here.

## Template

```
### RQ-<n>: <short title>
- Rule ref: <RuleSection id>
- Question: <what is unclear>
- Current interpretation: <what the code does now>
- Flag: <flag name, if any>
- Status: open | resolved (<how>)
```

## Open

### RQ-1: Conditional weapon keywords other than `non-X`

- Rule ref: `core.core-abilities` (weapon abilities), data `Datasheets_wargear.description`
- Question: the 11th edition data has forms like `LETHAL HITS: non-MONSTER/VEHICLE`. The core rules
  page does not describe the `KEYWORD: condition` notation itself.
- Current interpretation: `non-X/Y` means the keyword applies only when the target has neither X
  nor Y. Any other condition text is treated as always applying.
- Flag: `keywordApplies()` in `packages/engine/src/attack/context.ts`
- Status: open

### RQ-2: ANTI with several keywords

- Rule ref: `core.core-abilities.anti`
- Question: `ANTI-MONSTER/VEHICLE 4+` appears in the data; the rule text only shows single keywords.
- Current interpretation: the target qualifies if it has any of the listed keywords.
- Status: open

### RQ-3: "each model in that unit is a MONSTER/VEHICLE model" for hazard rolls

- Rule ref: `core.other-concepts.hazard-rolls`
- Question: the engine tracks keywords per unit, not per model (attached units can mix).
- Current interpretation: 3 mortal wounds per failed roll if the unit has MONSTER or VEHICLE.
- Status: open

## Resolved

None yet.
