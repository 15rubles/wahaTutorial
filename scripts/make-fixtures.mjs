// Generates fixtures/wahapedia/*.csv: two INVENTED factions in the exact shape of the Wahapedia
// export (same headers and column order, `|` delimiter, BOM, trailing `|`). Every name, number and
// sentence here is made up for tests. Run: node scripts/make-fixtures.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  'Either player’s turn'.replace('’', "'"),
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
    transport: '',
    virtual: 'false',
    is_support: 'false',
    leader_head: d.leads ? 'This model can be attached to the following unit:' : '',
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
      button: '•'.replace('•', '*'),
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
  abilities: [{ ref: '900000102', type: 'Faction' }],
  keywords: ['Infantry', 'Gutter Marksman'],
  composition: ['1 Gutter Marksman model'],
  costs: [['1 model', 40]],
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
console.log(`Wrote ${Object.keys(HEADERS).length} fixture CSVs (${ds} datasheets) to ${OUT}`);
