<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<!-- Invented test fixture. Not real game data. -->
<gameSystem id="sys-tg" name="Testing Grounds" revision="1" battleScribeVersion="2.03" xmlns="http://www.battlescribe.net/schema/gameSystemSchema">
  <costTypes>
    <costType id="ct-pts" name="pts" defaultCostLimit="-1"/>
    <costType id="ct-dp" name="Detachment Points" defaultCostLimit="-1"/>
  </costTypes>
  <profileTypes>
    <profileType id="pt-unit" name="Unit"/>
    <profileType id="pt-ranged" name="Ranged Weapons"/>
    <profileType id="pt-melee" name="Melee Weapons"/>
    <profileType id="pt-ab" name="Abilities"/>
  </profileTypes>
  <categoryEntries>
    <categoryEntry id="cat-character" name="Character"/>
    <categoryEntry id="cat-infantry" name="Infantry"/>
    <categoryEntry id="cat-battleline" name="Battleline"/>
    <categoryEntry id="cat-vehicle" name="Vehicle"/>
  </categoryEntries>
  <sharedRules>
    <rule id="r-shock" name="Shock Strike">
      <description>During the Declare Battle Formations step, this unit can be set up in reserve. It may arrive at the end of your opponent's Movement phase.</description>
    </rule>
    <rule id="r-rend" name="Rending Edge">
      <description>Each **Critical Strike** made with this weapon improves its AP by the number shown.</description>
    </rule>
    <rule id="r-crit" name="Critical Strike">
      <description>An unmodified hit roll of 6.</description>
    </rule>
    <rule id="r-pistol" name="Pistol">
      <description>Can be fired while within Engagement Range.</description>
    </rule>
  </sharedRules>
  <selectionEntries>
    <selectionEntry id="se-bs" name="Battle Size" type="upgrade">
      <selectionEntryGroups>
        <selectionEntryGroup id="seg-bs" name="Battle Size">
          <selectionEntries>
            <selectionEntry id="se-bs-skirmish" name="Skirmish (500 Point limit)" type="upgrade"/>
            <selectionEntry id="se-bs-grand" name="Grand Clash (2,000 Point limit)" type="upgrade"/>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>
    </selectionEntry>
  </selectionEntries>
</gameSystem>
