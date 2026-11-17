// Generates fixtures/wahapedia/*.csv: two INVENTED factions in the exact shape of the Wahapedia
// export (same headers and column order, `|` delimiter, BOM, trailing `|`). Every name, number and
// sentence here is made up for tests. Run: node scripts/make-fixtures.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'wahapedia');
const BOM = String.fromCharCode(0xfeff);
const SITE = 'https://example.invalid/fixtures';

const HEADERS = {
  Abilities: 'id|name|legend|faction_id|description',
  Datasheets:
    'id|name|faction_id|source_id|legend|role|loadout|transport|virtual|is_support|leader_head|leader_footer|damaged_w|damaged_description|link',
  Datasheets_abilities: 'datasheet_id|line|ability_id|model|name|description|type|parameter',
  Datasheets_detachment_abilities: 'datasheet_id|detachment_ability_id',
  Datasheets_enhancements: 'datasheet_id|enhancement_id',
  Datasheets_keywords: 'datasheet_id|keyword|model|is_faction_keyword',
  Datasheets_leader: 'leader_id|attached_id',
  Datasheets_models:
    'datasheet_id|line|name|M|T|Sv|inv_sv|inv_sv_descr|W|Ld|OC|base_size|base_size_descr',
  Datasheets_models_cost: 'datasheet_id|line|description|cost',
  Datasheets_options: 'datasheet_id|line|button|description',
  Datasheets_stratagems: 'datasheet_id|stratagem_id',
  Datasheets_unit_composition: 'datasheet_id|line|description',
  Datasheets_wargear:
    'datasheet_id|line|line_in_wargear|dice|name|description|range|type|A|BS_WS|S|AP|D',
  Detachment_abilities: 'id|faction_id|name|legend|description|detachment|detachment_id',
  Detachments: 'id|faction_id|name|legend|type|dp|force_disposition',
  Detachments_chapter_dp: 'detachment_id|keyword|dp',
  Enhancements:
    'faction_id|name|id|cost|detachment|detachment_id|upgrade|legend|description|support_leader',
  Enhancements_wargear:
    'enhancement_id|line|line_in_wargear|dice|name|description|range|type|A|BS_WS|S|AP|D',
  Factions: 'id|name|link',
  Last_update: 'last_update',
  Source: 'id|name|type|edition|version|errata_date|errata_link',
  Stratagems:
    'faction_id|name|id|type|cp_cost|legend|turn|phase|detachment|detachment_id|description',
};

const rows = Object.fromEntries(Object.keys(HEADERS).map((k) => [k, []]));
const add = (table, obj) => rows[table].push(obj);

// ---- Factions, source, update -------------------------------------------------------------
add('Factions', { id: 'RP', name: 'Rust Pilgrims', link: `${SITE}/factions/rust-pilgrims/` });
add('Factions', { id: 'GC', name: 'Glass Choir', link: `${SITE}/factions/glass-choir/` });
add('Source', {
  id: '900000900',
  name: 'Fixture Codex',
  type: 'Codex',
  edition: '11',
  version: '1.0',
  errata_date: '01.01.2026 0:00:00',
  errata_link: `${SITE}/codex.pdf`,
});
add('Last_update', { last_update: '2026-01-01 12:00:00' });

// ---- Shared abilities ----------------------------------------------------------------------
add('Abilities', {
  id: '900000101',
  name: 'Leader',
  legend: '',
  faction_id: '',
  description: 'Invented fixture text: this model may join a bodyguard unit listed on its card.',
});
add('Abilities', {
  id: '900000105',
  name: 'Deep Strike',
  legend: '',
  faction_id: '',
  description:
    'Invented fixture text: this unit may wait in reserves and arrive far from the enemy.',
});
add('Abilities', {
  id: '900000102',
  name: 'Pilgrim Toll',
  legend: 'The road is paid in rust.',
  faction_id: 'RP',
  description:
    'Invented fixture text: once per turn, a <span class="kwb">RUST</span> <span class="kwb">PILGRIMS</span> unit may re-roll one hit roll.',
});
add('Abilities', {
  id: '900000103',
  name: 'Resonant Chorus',
  legend: '',
  faction_id: 'GC',
  description: 'Invented fixture text: friendly units within 6" add 1 to their Leadership.',
});
// Same ability shared by both factions (the real export repeats the id per faction).
add('Abilities', {
  id: '900000104',
  name: 'Old Oaths',
  legend: '',
  faction_id: 'RP',
  description: 'Invented fixture text: shared by two factions.',
});
add('Abilities', {
  id: '900000104',
  name: 'Old Oaths',
  legend: '',
  faction_id: 'GC',
  description: 'Invented fixture text: shared by two factions.',
});

// ---- Detachments ---------------------------------------------------------------------------
add('Detachments', {
  id: '900000801',
  faction_id: 'RP',
  name: 'Scrap Procession',
  legend: '<p class="ShowFluff legend3">FIXTURE LEGEND</p>',
  type: '',
  dp: '1',
  force_disposition: 'Take and Hold, Purge the Foe',
});
add('Detachments', {
  id: '900000802',
  faction_id: 'GC',
  name: 'Shard Cantata',
  legend: '',
  type: '',
  dp: '2',
  force_disposition: 'Disruption',
});
add('Detachments_chapter_dp', { detachment_id: '900000801', keyword: 'Cinder Lancers', dp: '2' });
add('Detachment_abilities', {
  id: '900000701',
  faction_id: 'RP',
  name: 'Forward Through Ash',
  legend: '',
  description:
    'Invented fixture text: units from this army may advance and still shoot assault weapons.',
  detachment: 'Scrap Procession',
  detachment_id: '900000801',
});
add('Detachment_abilities', {
  id: '900000702',
  faction_id: 'GC',
  name: 'Refraction',
  legend: '',
  description: 'Invented fixture text: the first wound each turn is ignored on a 5+.',
  detachment: 'Shard Cantata',
  detachment_id: '900000802',
});

// ---- Stratagems ----------------------------------------------------------------------------
const strat = (id, faction_id, name, type, cp, turn, phase, detachment, detachment_id, body) =>
  add('Stratagems', {
    faction_id,
    name,
    id,
    type,
    cp_cost: String(cp),
    legend: 'Invented flavour line.',
    turn,
    phase,
    detachment,
    detachment_id,
    description: `<b>WHEN:</b> ${phase}.<br><br><b>EFFECT:</b> ${body}`,
  });
strat(
  '900000601',
  '',
  'STEADY HANDS',
  'Core - Battle Tactic Stratagem',
  1,
  'Your turn',
  'Shooting phase',
  '',
  '',
  'Invented fixture text: add 1 to one hit roll.',
);
strat(
  '900000602',
  'RP',
  'RIVET STORM',
  'Scrap Procession - Battle Tactic Stratagem',
  1,
  'Your turn',
  'Shooting phase',
  'Scrap Procession',
  '900000801',
  'Invented fixture text: ranged weapons gain an extra attack.',
);
strat(
  '900000603',
  'RP',
  'HOLD THE ROAD',
  'Scrap Procession - Strategic Ploy Stratagem',
  2,
  "Either player's turn",
  'Command phase',
  'Scrap Procession',
  '900000801',
  'Invented fixture text: one unit counts as controlling its objective.',
);
strat(
  '900000604',
  'GC',
  'SHATTER NOTE',
  'Shard Cantata - Battle Tactic Stratagem',
  1,
  'Your turn',
  'Fight phase',
  'Shard Cantata',
  '900000802',
  'Invented fixture text: melee attacks improve AP by 1.',
);

// ---- Enhancements --------------------------------------------------------------------------
add('Enhancements', {
  faction_id: 'RP',
  name: 'Lantern of Last Miles',
  id: '900000501',
  cost: '15',
  detachment: 'Scrap Procession',
  detachment_id: '900000801',
  upgrade: 'false',
  legend: '',
  description: 'Invented fixture text: the bearer adds 1 to its Move.',
  support_leader: '',
});
add('Enhancements', {
  faction_id: 'RP',
  name: 'Saint-Forged Maul',
  id: '900000502',
  cost: '25',
  detachment: 'Scrap Procession',
  detachment_id: '900000801',
  upgrade: 'false',
  legend: '',
  description: 'Invented fixture text: replaces the bearer melee weapon.',
  support_leader: '',
});
add('Enhancements_wargear', {
  enhancement_id: '900000502',
  line: '1',
  line_in_wargear: '1',
  dice: '',
  name: 'Saint-Forged Maul',
  description: 'lethal hits',
  range: 'Melee',
  type: 'Melee',
  A: '5',
  BS_WS: '2',
  S: '7',
  AP: '-2',
  D: '2',
});
add('Enhancements', {
  faction_id: 'GC',
  name: 'Tuning Fork Crown',
  id: '900000503',
  cost: '20',
  detachment: 'Shard Cantata',
  detachment_id: '900000802',
  upgrade: 'false',
  legend: '',
  description: 'Invented fixture text: the bearer has a 4+ invulnerable save.',
  support_leader: '',
});

// ---- Datasheets ----------------------------------------------------------------------------
let ds = 0;
function datasheet(d) {
  ds += 1;
  const id = d.id;
  add('Datasheets', {
    id,
    name: d.name,
    faction_id: d.faction,
    source_id: '900000900',
    legend: 'Invented fixture background.',
    role: d.role,
    loadout: `<b>This model is equipped with:</b> ${d.weapons.map((w) => w.name).join('; ')}.`,
    transport: d.transport ?? '',
    virtual: 'false',
    is_support: 'false',
    leader_head: d.leads ? 'Invented fixture text: leads these units.' : '',
    leader_footer: '',
    damaged_w: d.damaged ?? '',
    damaged_description: d.damaged ? 'Invented fixture text: subtract 1 from hit rolls.' : '',
    link: `${SITE}/datasheets/${d.name.toLowerCase().replace(/[^a-z]+/g, '-')}/`,
  });
  d.models.forEach((m, i) =>
    add('Datasheets_models', {
      datasheet_id: id,
      line: String(i + 1),
      name: m.name ?? d.name,
      M: m.M,
      T: m.T,
      Sv: m.Sv,
      inv_sv: m.inv ?? '-',
      inv_sv_descr: '',
      W: m.W,
      Ld: m.Ld,
      OC: m.OC,
      base_size: m.base,
      base_size_descr: '',
    }),
  );
  d.weapons.forEach((w, i) =>
    add('Datasheets_wargear', {
      datasheet_id: id,
      line: String(i + 1),
      line_in_wargear: '1',
      dice: '',
      name: w.name,
      description: w.kw ?? '',
      range: w.range,
      type: w.range === 'Melee' ? 'Melee' : 'Ranged',
      A: w.A,
      BS_WS: w.skill,
      S: w.S,
      AP: w.AP,
      D: w.D,
    }),
  );
  let line = 0;
  for (const a of d.abilities ?? []) {
    line += 1;
    add('Datasheets_abilities', {
      datasheet_id: id,
      line: String(line),
      ability_id: a.ref ?? '',
      model: '',
      name: a.name ?? '',
      description: a.text ?? '',
      type: a.type,
      parameter: a.param ?? '',
    });
  }
  for (const k of d.keywords)
    add('Datasheets_keywords', {
      datasheet_id: id,
      keyword: k,
      model: '',
      is_faction_keyword: 'false',
    });
  add('Datasheets_keywords', {
    datasheet_id: id,
    keyword: d.faction === 'RP' ? 'Rust Pilgrims' : 'Glass Choir',
    model: '',
    is_faction_keyword: 'true',
  });
  d.composition.forEach((c, i) =>
    add('Datasheets_unit_composition', { datasheet_id: id, line: String(i + 1), description: c }),
  );
  add('Datasheets_models_cost', {
    datasheet_id: id,
    line: '1',
    description: 'YOUR UNIT COSTS',
    cost: '',
  });
  d.costs.forEach(([desc, cost], i) =>
    add('Datasheets_models_cost', {
      datasheet_id: id,
      line: String(i + 2),
      description: desc,
      cost: String(cost),
    }),
  );
  (d.options ?? []).forEach((o, i) =>
    add('Datasheets_options', {
      datasheet_id: id,
      line: String(i + 1),
      button: '*',
      description: o,
    }),
  );
  for (const s of d.stratagems ?? [])
    add('Datasheets_stratagems', { datasheet_id: id, stratagem_id: s });
  for (const e of d.enhancements ?? [])
    add('Datasheets_enhancements', { datasheet_id: id, enhancement_id: e });
  for (const a of d.detachmentAbilities ?? [])
    add('Datasheets_detachment_abilities', { datasheet_id: id, detachment_ability_id: a });
  for (const target of d.leads ?? [])
    add('Datasheets_leader', { leader_id: id, attached_id: target });
}

const RP_STRATS = ['900000601', '900000602', '900000603'];
const GC_STRATS = ['900000601', '900000604'];

datasheet({
  id: '900000001',
  name: 'Pilgrim Scrapwarden',
  faction: 'RP',
  role: 'Infantry Character',
  models: [{ M: '6"', T: '4', Sv: '3+', inv: '5', W: '5', Ld: '6+', OC: '1', base: '40mm' }],
  weapons: [
    {
      name: 'Rivet pistol',
      kw: 'pistol',
      range: '12"',
      A: '1',
      skill: '3',
      S: '5',
      AP: '-1',
      D: '1',
    },
    {
      name: 'Scrap maul',
      kw: 'lethal hits',
      range: 'Melee',
      A: '4',
      skill: '3',
      S: '6',
      AP: '-1',
      D: '2',
    },
  ],
  abilities: [
    { ref: '900000101', type: 'Core' },
    { ref: '900000102', type: 'Faction' },
    {
      name: 'Oil-Black Oath',
      text: 'Invented fixture text: while leading a unit, that unit adds 1 to wound rolls in melee.',
      type: 'Datasheet',
    },
  ],
  keywords: ['Infantry', 'Character', 'Grenades', 'Pilgrim Scrapwarden'],
  composition: ['1 Pilgrim Scrapwarden model'],
  costs: [['1 model', 60]],
  leads: ['900000002'],
  stratagems: RP_STRATS,
  enhancements: ['900000501', '900000502'],
  detachmentAbilities: ['900000701'],
});
datasheet({
  id: '900000002',
  name: 'Rustbound Devotees',
  faction: 'RP',
  role: 'Battleline',
  models: [
    {
      name: 'Rustbound Devotee',
      M: '6"',
      T: '3',
      Sv: '5+',
      W: '1',
      Ld: '7+',
      OC: '2',
      base: '28mm',
    },
  ],
  weapons: [
    {
      name: 'Nail caster',
      kw: 'rapid fire 1',
      range: '18"',
      A: '2',
      skill: '4',
      S: '4',
      AP: '0',
      D: '1',
    },
    { name: 'Corroded blade', kw: '', range: 'Melee', A: '1', skill: '4', S: '3', AP: '0', D: '1' },
  ],
  abilities: [
    { ref: '900000102', type: 'Faction' },
    { ref: '900000104', type: 'Faction' },
  ],
  keywords: ['Infantry', 'Battleline', 'Rustbound Devotees'],
  composition: ['10 Rustbound Devotee models'],
  costs: [['10 models', 80]],
  options: [
    'Invented fixture option: any number of models can replace their nail caster with a corroded blade.',
  ],
  stratagems: RP_STRATS,
  detachmentAbilities: ['900000701'],
});
datasheet({
  id: '900000003',
  name: 'Cinder Lancers',
  faction: 'RP',
  role: 'Mounted',
  models: [
    { name: 'Cinder Lancer', M: '12"', T: '5', Sv: '4+', W: '3', Ld: '7+', OC: '2', base: '60mm' },
  ],
  weapons: [
    {
      name: 'Spark carbine',
      kw: 'assault',
      range: '12"',
      A: '1',
      skill: '4',
      S: '4',
      AP: '0',
      D: '1',
    },
    {
      name: 'Ember lance',
      kw: 'lance',
      range: 'Melee',
      A: '3',
      skill: '3',
      S: '6',
      AP: '-2',
      D: '2',
    },
  ],
  abilities: [{ ref: '900000102', type: 'Faction' }],
  keywords: ['Mounted', 'Cinder Lancers'],
  composition: ['3 Cinder Lancer models'],
  costs: [['3 models', 70]],
  stratagems: RP_STRATS,
  detachmentAbilities: ['900000701'],
});
datasheet({
  id: '900000004',
  name: 'Furnace Walker',
  faction: 'RP',
  role: 'Walker',
  damaged: '1-3',
  models: [{ M: '8"', T: '9', Sv: '3+', W: '10', Ld: '7+', OC: '3', base: '90mm' }],
  weapons: [
    {
      name: 'Slag cannon',
      kw: 'blast',
      range: '36"',
      A: 'D6',
      skill: '4',
      S: '9',
      AP: '-2',
      D: '3',
    },
    {
      name: 'Melta spigot',
      kw: 'melta 2',
      range: '12"',
      A: '1',
      skill: '3',
      S: '8',
      AP: '-4',
      D: 'D6',
    },
    {
      name: 'Ember flamer',
      kw: 'torrent, ignores cover',
      range: '12"',
      A: 'D6',
      skill: 'N/A',
      S: '5',
      AP: '-1',
      D: '1',
    },
    {
      name: 'Crushing claws',
      kw: '',
      range: 'Melee',
      A: '4',
      skill: '4',
      S: '10',
      AP: '-2',
      D: '3',
    },
  ],
  abilities: [{ ref: '900000102', type: 'Faction' }],
  keywords: ['Vehicle', 'Walker', 'Furnace Walker'],
  composition: ['1 Furnace Walker model'],
  costs: [['1 model', 150]],
  stratagems: RP_STRATS,
  detachmentAbilities: ['900000701'],
});
datasheet({
  id: '900000005',
  name: 'Gutter Marksman',
  faction: 'RP',
  role: 'Infantry',
  models: [{ M: '6"', T: '3', Sv: '5+', W: '2', Ld: '7+', OC: '1', base: '28mm' }],
  weapons: [
    {
      name: 'Long rivet rifle',
      kw: 'heavy, precision',
      range: '36"',
      A: '1',
      skill: '3',
      S: '5',
      AP: '-2',
      D: '3',
    },
    { name: 'Gutter knife', kw: '', range: 'Melee', A: '2', skill: '4', S: '3', AP: '0', D: '1' },
  ],
  abilities: [
    { ref: '900000105', type: 'Core' },
    { ref: '900000102', type: 'Faction' },
  ],
  keywords: ['Infantry', 'Gutter Marksman'],
  composition: ['1 Gutter Marksman model'],
  costs: [['1 model', 40]],
  stratagems: RP_STRATS,
});

datasheet({
  id: '900000006',
  name: 'Rust Crawler',
  faction: 'RP',
  role: 'Dedicated Transport',
  transport: 'Invented fixture text: carries up to 10 Rust Pilgrims Infantry models.',
  models: [{ M: '10"', T: '9', Sv: '3+', W: '10', Ld: '7+', OC: '2', base: '100mm' }],
  weapons: [
    {
      name: 'Rivet repeater',
      kw: 'rapid fire 2',
      range: '24"',
      A: '3',
      skill: '4',
      S: '5',
      AP: '0',
      D: '1',
    },
    { name: 'Crawler treads', kw: '', range: 'Melee', A: '3', skill: '4', S: '6', AP: '0', D: '1' },
  ],
  abilities: [{ ref: '900000102', type: 'Faction' }],
  keywords: ['Vehicle', 'Transport', 'Dedicated Transport', 'Rust Crawler'],
  composition: ['1 Rust Crawler model'],
  costs: [['1 model', 80]],
  stratagems: RP_STRATS,
});

datasheet({
  id: '900000011',
  name: 'Choir Precentor',
  faction: 'GC',
  role: 'Infantry Character',
  models: [{ M: '7"', T: '4', Sv: '4+', inv: '4', W: '4', Ld: '6+', OC: '1', base: '32mm' }],
  weapons: [
    {
      name: 'Resonance pistol',
      kw: 'pistol',
      range: '12"',
      A: '2',
      skill: '3',
      S: '4',
      AP: '-1',
      D: '1',
    },
    {
      name: 'Shard blade',
      kw: 'sustained hits 1',
      range: 'Melee',
      A: '5',
      skill: '2',
      S: '5',
      AP: '-2',
      D: '1',
    },
  ],
  abilities: [
    { ref: '900000101', type: 'Core' },
    { ref: '900000103', type: 'Faction' },
  ],
  keywords: ['Infantry', 'Character', 'Choir Precentor'],
  composition: ['1 Choir Precentor model'],
  costs: [['1 model', 65]],
  leads: ['900000012'],
  stratagems: GC_STRATS,
  enhancements: ['900000503'],
  detachmentAbilities: ['900000702'],
});
datasheet({
  id: '900000012',
  name: 'Glass Wardens',
  faction: 'GC',
  role: 'Battleline',
  models: [
    { name: 'Glass Warden', M: '6"', T: '4', Sv: '3+', W: '2', Ld: '6+', OC: '2', base: '32mm' },
  ],
  weapons: [
    {
      name: 'Splinter repeater',
      kw: 'anti-infantry 4+, LETHAL HITS: non-MONSTER/VEHICLE',
      range: '24"',
      A: '3',
      skill: '3',
      S: '4',
      AP: '-1',
      D: '1',
    },
    { name: 'Glass edge', kw: '', range: 'Melee', A: '2', skill: '3', S: '4', AP: '0', D: '1' },
  ],
  abilities: [
    { ref: '900000103', type: 'Faction' },
    { ref: '900000104', type: 'Faction' },
  ],
  keywords: ['Infantry', 'Battleline', 'Glass Wardens'],
  composition: ['5 Glass Warden models'],
  costs: [['5 models', 90]],
  stratagems: GC_STRATS,
  detachmentAbilities: ['900000702'],
});
datasheet({
  id: '900000013',
  name: 'Prism Engine',
  faction: 'GC',
  role: 'Vehicle',
  damaged: '1-4',
  models: [
    { M: '10"', T: '10', Sv: '3+', inv: '5', W: '12', Ld: '7+', OC: '3', base: 'Use model' },
  ],
  weapons: [
    {
      name: 'Refractor beam',
      kw: 'anti-vehicle 4+, devastating wounds, hazardous',
      range: '48"',
      A: '2',
      skill: '3',
      S: '12',
      AP: '-3',
      D: 'D6+1',
    },
    {
      name: 'Shard spray',
      kw: 'sustained hits d3, twin-linked',
      range: '18"',
      A: 'D3',
      skill: '3',
      S: '5',
      AP: '0',
      D: '1',
    },
    { name: 'Armoured hull', kw: '', range: 'Melee', A: '3', skill: '4', S: '6', AP: '0', D: '1' },
  ],
  abilities: [{ ref: '900000103', type: 'Faction' }],
  keywords: ['Vehicle', 'Prism Engine'],
  composition: ['1 Prism Engine model'],
  costs: [['1 model', 170]],
  stratagems: GC_STRATS,
  detachmentAbilities: ['900000702'],
});
datasheet({
  id: '900000014',
  name: 'Echo Skimmers',
  faction: 'GC',
  role: 'Mounted',
  models: [
    {
      name: 'Echo Skimmer',
      M: '14"',
      T: '4',
      Sv: '4+',
      W: '2',
      Ld: '7+',
      OC: '1',
      base: '60mm oval',
    },
  ],
  weapons: [
    {
      name: 'Hum carbine',
      kw: 'assault, rapid fire 1',
      range: '18"',
      A: '2',
      skill: '3',
      S: '4',
      AP: '0',
      D: '1',
    },
    {
      name: 'Hum lance',
      kw: 'extra attacks',
      range: 'Melee',
      A: '1',
      skill: '3',
      S: '5',
      AP: '-1',
      D: '1',
    },
  ],
  abilities: [{ ref: '900000103', type: 'Faction' }],
  keywords: ['Mounted', 'Fly', 'Echo Skimmers'],
  composition: ['3 Echo Skimmer models'],
  costs: [['3 models', 75]],
  stratagems: GC_STRATS,
  detachmentAbilities: ['900000702'],
});

// ---- Write ---------------------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
for (const [table, header] of Object.entries(HEADERS)) {
  const cols = header.split('|');
  const eol = table === 'Factions' ? '\r\n' : '\n'; // the real export mixes both
  const lines = [
    header + '|',
    ...rows[table].map((r) => cols.map((c) => r[c] ?? '').join('|') + '|'),
  ];
  writeFileSync(join(OUT, `${table}.csv`), BOM + lines.join(eol) + eol, 'utf8');
}
writeFileSync(join(OUT, 'core-rules.html'), coreRulesHtml(), 'utf8');
writeRosters();
console.log(
  `Wrote ${Object.keys(HEADERS).length} fixture CSVs + core-rules.html (${ds} datasheets) to ${OUT}`,
);

// ---- Core rules page ---------------------------------------------------------------------
// Same markup patterns as the real page (see docs/data-schema.md), with short section titles and
// INVENTED placeholder bodies. Produces the same rule ids as the real page for these sections.
function coreRulesHtml() {
  const body = (title) =>
    `<p>Fixture text for ${title}. This is invented placeholder text for tests, not a rule.</p>`;
  const parts = [];
  const anchor = (t) => t.replace(/[^A-Za-z0-9.]+/g, '-').replace(/-+$/, '');
  const group = (t) =>
    parts.push(`<h2 id="${anchor(t)}" class="super_header" style="display:flex;">${t}</h2>`);
  const top = (t, code, tag = 'h3', red = 'h_number_red') =>
    parts.push(
      `<div class="BreakInsideAvoid"><a name="${anchor(t)}"></a><${tag} id="${anchor(t)}" class="outline_header" style="display:flex;">${t} <div class="${red}">${code}${red.endsWith('2') ? ' <div class="headerWrap"></div>' : ''}</div></${tag}><p class="legend">${body(t)}</p></div>`,
    );
  const sec = (t, code, tag = 'h2') =>
    parts.push(
      `<div class="BreakInsideAvoid"><a name="${anchor(t)}"></a><${tag} id="${anchor(t)}" style="display:flex;">${t} <span class="h_number">${code}</span></${tag}>${body(t)}<div><br></div></div>`,
    );
  const sub = (t) =>
    parts.push(
      `<div class="BreakInsideAvoid"><h3 id="${anchor(t)}" style="display:flex;">${t}</h3>${body(t)}</div>`,
    );
  const box = (t, code) =>
    parts.push(
      `<a name="${anchor(t)}"></a><div class=" BreakInsideAvoid"> <div class="str11Wrap"> <div class="str11BodyWrap"> <div id="${anchor(t)}" class="str11HeadBlock str11Name">${t}<span class="h_number">${code}</span></div> </div> <div class="str11BodyWrap"> <div class="str11TextWrap"> <div class="str11Text">${body(t)}</div> </div> </div> </div></div>`,
    );
  const ability = (t, code) =>
    parts.push(
      `<div class="abWrap BreakInsideAvoid"><div class="abNameWrap"><div class="abName">${t}<span class="h_number">${code}</span></div><div class="abIcon"></div></div><p class="ShowFluff abLegend">Invented flavour.</p>${body(t)}</div>`,
    );
  const faq = () =>
    parts.push(
      `<div class="faqErrataSpoiler faqErrataCollapsed"><div class="faqErrataHead"><h3>FAQ</h3><div class="btnFaqErrataToggle"><span class="FaqErrataToggleText">Show</span></div></div><div class="faqErrataSpoilerBody"><div class="faq">Q: Invented question? A: Invented answer.</div></div></div>`,
    );
  const junk = () =>
    parts.push(
      `<div class="tooltip_templates"><span id="tooltip_content00001"><div class="abName">[LETHAL HITS]<span class="h_number">24.23</span></div>Tooltip copy that must be ignored.</span></div><script>var ignored = 1;</script>`,
    );

  group('BASIC RULES');
  top('Core Concepts', '01');
  sec('Measuring Distances', '01.04');
  sec('Dice', '01.05');
  parts.push('<p>Dice faces: unmodified <div class="cruD6"></div> example.</p>');
  sec('Battle-shock Rolls', '01.07');
  top('Datasheets', '02');
  sec('2. Profiles', '02.02', 'h3');
  sec('4. Weapons', '02.04', 'h3');
  sec('5. Keywords', '02.05', 'h3');
  parts.push('<p>Keyword example: <span class="kwb">INFANTRY</span> units.</p>');
  top('Moving', '03');
  sec('Moving Units', '03.01');
  sub('Ending a Move');
  sec('Coherency', '03.03');
  sec('Engagement', '03.04');
  top('Making Attacks', '04');
  sec('1. Select Weapons', '04.01');
  sec('2. Select Targets', '04.02');
  sec('3. Resolve Attacks', '04.03');
  top('Attack Sequence', '05');
  sec('1. Hit Roll', '05.01');
  faq();
  junk();
  sec('Critical Hits and Critical Wounds', '05.01.01', 'h3');
  sec('2. Wound Roll', '05.02');
  parts.push(
    '<p>See the <a href="/wh40k11ed/the-rules/core-rules/#1.-Hit-Roll">hit roll</a> and <a href="/wh40k11ed/factions/example/">a faction page</a>.</p>',
  );
  sec('3. Save Rolls', '05.03');
  sec('Saving Throw', '05.03.01', 'h3');
  sec('4. Inflict Damage', '05.04');
  top('Other Concepts', '06', 'h2');
  sec('Visibility', '06.01');
  sec('Mortal Wounds', '06.02');
  sec('Hazard Rolls', '06.03');

  group('THE BATTLE ROUND');
  parts.push(
    `<div class="BreakInsideAvoid"><h2 id="The-Battle-Round-1" class="outline_header">The Battle Round <div class="h_number_red">07</div></h2>${body('The Battle Round')}</div>`,
  );
  sec('1. Start of Battle Round', '07.01');
  sec('2. Player Turns', '07.02');
  sec('3. End of Battle Round', '07.03');
  top('Command Phase', '08', 'h2', 'h_number_red2');
  sec('1. Start of Command Phase', '08.01');
  sec('2. Gain Core CP', '08.02');
  sec('3. Battle-shock Step', '08.03');
  sec('4. Command Abilities', '08.04');
  sec('5. End of Command Phase', '08.05');
  top('Movement Phase', '09', 'h3', 'h_number_red2');
  sec('1. Start of Movement Phase', '09.01');
  sec('2. Move Units Step', '09.02');
  sec('3. End of Movement Phase', '09.03');
  box('REMAIN STATIONARY', '09.04');
  box('NORMAL MOVE', '09.05');
  box('ADVANCE MOVE', '09.06');
  box('FALL-BACK MOVE', '09.07');
  top('Shooting Phase', '10', 'h3', 'h_number_red2');
  sec('1. Start of Shooting Phase', '10.01');
  sec('2. Shoot', '10.02');
  sec('3. End of Shooting Phase', '10.03');
  box('NORMAL SHOOTING', '10.04');
  box('ASSAULT SHOOTING', '10.05');
  top('Charge Phase', '11', 'h3', 'h_number_red2');
  sec('1. Start of Charge Phase', '11.01');
  sec('2. Charge Step', '11.02');
  sec('3. End of Charge Phase', '11.03');
  box('CHARGE MOVE', '11.04');
  top('Fight Phase', '12', 'h3', 'h_number_red2');
  sec('1. Start of Fight Phase', '12.01');
  sec('2. Pile In', '12.02');
  box('PILE-IN MOVE', '12.03');
  sec('3. Fight Step', '12.04');
  box('NORMAL FIGHT', '12.05');
  sec('4. Consolidate', '12.07');
  box('CONSOLIDATION MOVE', '12.08');
  sec('5. End of Fight Phase', '12.09');

  group('BATTLEFIELDS AND TACTICS');
  top('Terrain', '13', 'h2');
  sec('Benefit of Cover', '13.08', 'h3');
  sec('Obscuring', '13.10', 'h3');
  top('Objectives', '14', 'h2');
  sec('Level of Control', '14.02');
  top('Stratagems', '15', 'h2');
  sec('Using Stratagems', '15.01');

  group('ADVANCED RULES');
  top('Monsters and Vehicles', '17', 'h2');
  top('Transports', '18', 'h3');
  top('Attached Units', '19', 'h2');
  sec('Forming Attached Units', '19.01');
  ability('LEADER<span class="h_number">24.22</span> / SUPPORT', '24.34');
  sec('Attacking Attached Units', '19.02');

  group('REFERENCE');
  top('Core Abilities', '24', 'h2');
  for (const [t, c] of [
    ['[ANTI]', '24.03'],
    ['[ASSAULT]', '24.04'],
    ['[BLAST]', '24.05'],
    ['[DEVASTATING WOUNDS]', '24.10'],
    ['[EXTRA ATTACKS]', '24.11'],
    ['[HAZARDOUS]', '24.15'],
    ['[HEAVY]', '24.16'],
    ['[IGNORES COVER]', '24.18'],
    ['[LANCE]', '24.21'],
    ['[LETHAL HITS]', '24.23'],
    ['[MELTA]', '24.25'],
    ['[PISTOL]', '24.27'],
    ['[PRECISION]', '24.28'],
    ['[RAPID FIRE]', '24.30'],
    ['[SUSTAINED HITS]', '24.36'],
    ['[TORRENT]', '24.37'],
    ['[TWIN-LINKED]', '24.38'],
  ])
    ability(t, c);

  return `<!doctype html><html><head><title>Fixture core rules</title></head><body><!--noindex--><div>site menu</div><!--/noindex-->
<h1 class="page_header">Core Rules</h1>
${parts.join('\n')}
<!--noindex--><div class="tooltip_templates"><form id="disable-ads"><h4>Disable Ads</h4></form></div><!--/noindex--></body></html>
`;
}

// ---- Rosters -----------------------------------------------------------------------------
// Invented army lists in the shapes of BattleScribe / New Recruit XML and two text export styles.
function writeRosters() {
  const dir = join(OUT, '..', 'rosters');
  mkdirSync(dir, { recursive: true });
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  let n = 0;
  const id = () => `fx-${(++n).toString(16).padStart(4, '0')}`;
  const cost = (v) => `<costs><cost name="pts" typeId="points" value="${v}"/></costs>`;
  const sel = (name, type, number, children = '', pts = 0) =>
    `<selection id="${id()}" name="${esc(name)}" entryId="${id()}" number="${number}" type="${type}">${pts ? cost(pts) : ''}${children ? `<selections>${children}</selections>` : ''}</selection>`;
  const ros = (
    name,
    catalogue,
    total,
    config,
    units,
  ) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<roster id="${id()}" name="${esc(name)}" battleScribeVersion="2.03" generatedBy="fixture" gameSystemId="fixture-system" gameSystemName="Fixture System" gameSystemRevision="1" xmlns="http://www.battlescribe.net/schema/rosterSchema">
  ${cost(total)}
  <forces>
    <force id="${id()}" name="Army Roster" entryId="${id()}" catalogueId="${id()}" catalogueRevision="1" catalogueName="${esc(catalogue)}">
      <selections>
        ${config}
        ${units.join('\n        ')}
      </selections>
    </force>
  </forces>
</roster>
`;

  const rp = ros(
    'Rust Pilgrims Test List',
    'Fixture - Rust Pilgrims',
    455,
    sel('Battle Size', 'upgrade', 1, sel('Incursion (1000 Point limit)', 'upgrade', 1)) +
      sel('Detachment', 'upgrade', 1, sel('Scrap Procession', 'upgrade', 1)),
    [
      sel(
        'Pilgrim Scrapwarden',
        'model',
        1,
        sel('Warlord', 'upgrade', 1) +
          sel('Rivet Pistol', 'upgrade', 1) +
          sel('Scrap maul', 'upgrade', 1) +
          sel('Enhancements', 'upgrade', 1, sel('Lantern of Last Miles', 'upgrade', 1, '', 15)),
        60,
      ),
      sel(
        'Rustbound Devotees',
        'unit',
        1,
        sel(
          'Rustbound Devotee',
          'model',
          8,
          sel('Nail caster', 'upgrade', 8) + sel('Corroded blade', 'upgrade', 8),
        ) + sel('Rustbound Devotee w/ blade', 'model', 2, sel('Corroded blade', 'upgrade', 2)),
        80,
      ),
      sel(
        'Cinder Lancers',
        'unit',
        1,
        sel(
          'Cinder Lancer',
          'model',
          3,
          sel('Spark carbine', 'upgrade', 3) + sel('Ember lance', 'upgrade', 3),
        ),
        70,
      ),
      sel(
        'Furnace Walker',
        'model',
        1,
        sel('Slag cannon', 'upgrade', 1) +
          sel('Melta spigot', 'upgrade', 1) +
          sel('Crushing claws', 'upgrade', 1),
        150,
      ),
      sel('Gutter Marksmen', 'model', 1, '', 40),
    ],
  );
  writeFileSync(join(dir, 'rust-pilgrims.ros'), rp, 'utf8');
  writeFileSync(
    join(dir, 'rust-pilgrims.rosz'),
    zipSync({ 'rust-pilgrims.ros': strToU8(rp) }, { mtime: new Date('2026-01-01T00:00:00Z') }),
  );

  const gc = ros(
    'Glass Choir Test List',
    'Fixture - Glass Choir',
    400,
    sel('Detachment', 'upgrade', 1, sel('Shard Cantata', 'upgrade', 1)),
    [
      sel(
        'Choir Precentor',
        'model',
        1,
        sel('Warlord', 'upgrade', 1) +
          sel('Shard blade', 'upgrade', 1) +
          sel('Resonance pistol', 'upgrade', 1),
        65,
      ),
      sel(
        'Glass Wardens',
        'unit',
        1,
        sel(
          'Glass Warden',
          'model',
          5,
          sel('Splinter repeater', 'upgrade', 5) + sel('Glass edge', 'upgrade', 5),
        ),
        90,
      ),
      sel(
        'Prism Engine',
        'model',
        1,
        sel('Refractor beam', 'upgrade', 1) + sel('Shard spray', 'upgrade', 1),
        170,
      ),
      sel('Echo Skimmers', 'unit', 1, sel('Echo Skimmer', 'model', 3), 75),
    ],
  );
  writeFileSync(join(dir, 'glass-choir.ros'), gc, 'utf8');

  // Official app style text export.
  writeFileSync(
    join(dir, 'rust-pilgrims-app.txt'),
    [
      'Rust Pilgrims Test List (455 points)',
      '',
      'Rust Pilgrims',
      'Scrap Procession',
      'Incursion (1000 points)',
      '',
      'CHARACTERS',
      '',
      'Pilgrim Scrapwarden (75 points)',
      '  \u2022 Warlord',
      '  \u2022 1x Rivet pistol',
      '  \u2022 1x Scrap maul',
      '  \u2022 Enhancement: Lantern of Last Miles',
      '',
      'BATTLELINE',
      '',
      'Rustbound Devotees (80 points)',
      '  \u2022 10x Rustbound Devotee',
      '    \u25e6 8x Nail caster',
      '    \u25e6 10x Corroded blade',
      '',
      'OTHER DATASHEETS',
      '',
      "Cinder Lancer's (70 points)",
      '  \u2022 3x Cinder Lancer',
      '    \u25e6 3x Spark carbine',
      '    \u25e6 3x Ember lance',
      '',
      'Furnace Walker (150 points)',
      '  \u2022 1x Slag cannon',
      '  \u2022 1x Melta spigot',
      '  \u2022 1x Crushing claws',
      '',
      'Gutter Marksman (40 points)',
      '',
      'Exported with App Version: v0.0 (fixture)',
      '',
    ].join('\n'),
    'utf8',
  );

  // New Recruit style text export.
  writeFileSync(
    join(dir, 'rust-pilgrims-newrecruit.txt'),
    [
      '+++++++++++++++++++++++++++++++++++++++++++++++',
      '+ FACTION KEYWORD: Fixture - Rust Pilgrims',
      '+ DETACHMENT: Scrap Procession',
      '+ TOTAL ARMY POINTS: 455pts',
      '+++++++++++++++++++++++++++++++++++++++++++++++',
      '',
      'Char1: 1x Pilgrim Scrapwarden (75 pts): Warlord, Rivet pistol, Scrap maul',
      'Enhancement: Lantern of Last Miles (+15 pts)',
      '',
      '1x Rustbound Devotees (80 pts): 8x Nail caster, 10x Corroded blade',
      '1x Cinder Lancers (70 pts): 3x Spark carbine, 3x Ember lance',
      '1x Furnace Walker (150 pts): Slag cannon, Melta spigot, Crushing claws',
      '1x Gutter Marksman (40 pts)',
      '',
    ].join('\n'),
    'utf8',
  );

  // A roster with problems: an unknown unit, a typo, a garbage line, an unknown enhancement.
  writeFileSync(
    join(dir, 'broken.txt'),
    [
      'Broken Test List (300 points)',
      'Rust Pilgrims',
      '',
      'Pilgrim Scrapwardn (60 points)',
      '  \u2022 Enhancement: Crown of Nothing',
      'Totally Unknown Battle Robot (200 points)',
      '%%% not a roster line %%%',
      'Rustbound Devotees (80 points)',
      '',
    ].join('\n'),
    'utf8',
  );
}
