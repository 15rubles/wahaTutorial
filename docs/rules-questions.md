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
- Question: enforcing "each model that can end within 1" (then: engaged) of a charge target must do
  so" exactly needs a search over all legal placements.
- Current interpretation: enforced conservatively (`phases/chargeProximity.ts`). A model breaks the
  rule only if a straight-line spot next to a target model was free for it: on the battlefield,
  outside terrain, no overlapping bases, unit still coherent, within the charge roll. Errors
  `MUST_END_WITHIN_1` and `MUST_END_ENGAGED`. `chargePositions` builds moves that pass the check
  (used by the AI and the UI charge buttons).
- Flag: `ENFORCE_CHARGE_PROXIMITY` (on)
- Status: open (approximation; paths around terrain are not searched)

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

### RQ-8: Indirect shooting spotter

- Rule ref: `core.shooting-phase.indirect-shooting`
- Question: the better hit roll needs the target to be visible to "one or more friendly units". It is
  not clear whether the shooting unit itself counts.
- Current interpretation: it counts (`seenByFriends` in phases/shooting.ts). Re-roll limits and the
  "not eligible to start an action" part are not modelled (the engine has no hit re-rolls or actions).
- Status: open

### RQ-9: Which models a TRANSPORT can carry

- Rule ref: `core.transports.transport-capacity`
- Question: capacity and allowed passengers are free text on each datasheet (keywords, models that
  take more space, units that cannot embark).
- Current interpretation: only the model count is checked, using the first number of models in the
  text (127 of 131 transports in the cache have one). The text is kept on the unit for display.
- Status: open (simplification)

### RQ-10: Combat disembark

- Rule ref: `core.transports.disembark-move`
- Question: combat disembark (6", hazard rolls, may end engaged) applies when a tactical set-up is not
  possible; deciding "not possible" needs a placement search.
- Current interpretation: not offered. Rapid and tactical disembarks are modelled, plus emergency
  disembark when a transport is destroyed. Firing from inside a transport is not modelled.
- Status: open (simplification)

## Resolved

None yet.
