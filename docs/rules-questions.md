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

- Rule ref: `core.other-concepts.hazard-rolls`
- Question: the engine tracks keywords per unit, not per model (attached units can mix).
- Current interpretation: 3 mortal wounds per failed roll if the unit has MONSTER or VEHICLE.
- Status: open

### RQ-4: Charge move "must end within 1" / engaged if it can"

- Rule ref: `core.charge-phase.charge-move`
- Question: enforcing "each model that can end within 1" of a charge target must do so" needs a search
  over all legal placements.
- Current interpretation: not enforced. The engine enforces closer-to-target, engaged with every
  target and not engaged with other units. The UI's charge helper always ends models as close as it can.
- Status: open (simplification)

### RQ-5: Selecting the next fighter after the Fights First units are used up

- Rule ref: `core.fight-phase.fight-step`
- Question: who picks first once the Fights First units are done is modelled as
  "the player after the one who fought last".
- Current interpretation: `nextFightSelector()` alternates; a player with no eligible unit passes.
- Status: open

### RQ-6: Strategic reserves points limit

- Rule ref: `core.strategic-reserves.placing-units-in-strategic-reserves`
- Question: the limit on how many points may start in reserves needs unit points, which engine units
  do not carry.
- Current interpretation: not checked. Any unit except fortifications can be placed in reserves.
- Status: open (simplification)

### RQ-7: More than one leader in a bodyguard unit

- Rule ref: `core.attached-units.forming-attached-units`, `core.core-abilities.leader-support`
- Question: some datasheets allow extra leaders beyond one leader plus one support unit; those
  exceptions live in ability text the app does not interpret.
- Current interpretation: a bodyguard takes one leader, plus one more only when exactly one of the two
  is a support unit (`canAttach` in packages/roster/src/attachments.ts).
- Status: open (simplification)

## Resolved

None yet.
