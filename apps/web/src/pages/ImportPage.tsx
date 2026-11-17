import { useState } from 'react';
import { useArmy } from '../army/store.js';
import { useData } from '../data/store.js';
import { navigate } from '../router.js';

const DEMO_ROSTERS = [
  ['rust-pilgrims.ros', 'Rust Pilgrims (.ros)'],
  ['rust-pilgrims-app.txt', 'Rust Pilgrims (app text)'],
  ['glass-choir.ros', 'Glass Choir (.ros)'],
  ['broken.txt', 'A roster with problems'],
] as const;

export function ImportPage() {
  const { importFile, importing, importError } = useArmy();
  const source = useData((s) => s.source);
  const [text, setText] = useState('');

  const finish = async (name: string, content: Uint8Array | string) => {
    const army = await importFile(name, content);
    if (army) navigate('army');
  };

  return (
    <section className="import-page">
      <h2>Import your army</h2>
      <p className="muted">
        BattleScribe or New Recruit files (<code>.ros</code>, <code>.rosz</code>) or a text export
        from the official app or New Recruit. The file stays in your browser.
      </p>
      <div className="panel">
        <label className="file-drop">
          <span>Choose a roster file</span>
          <input
            type="file"
            accept=".ros,.rosz,.txt,text/plain,application/xml"
            data-testid="roster-file"
            disabled={importing}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await finish(file.name, new Uint8Array(await file.arrayBuffer()));
            }}
          />
        </label>
      </div>
      <div className="panel">
        <label htmlFor="roster-text">Or paste a text export</label>
        <textarea
          id="roster-text"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Unit name (80 points)\n  - 1x Weapon'}
        />
        <button
          type="button"
          disabled={importing || !text.trim()}
          onClick={() => void finish('pasted.txt', text)}
        >
          Import text
        </button>
      </div>
      {source === 'fixture' && (
        <div className="panel">
          <p>Demo rosters (invented factions):</p>
          <div className="button-row">
            {DEMO_ROSTERS.map(([file, label]) => (
              <button
                key={file}
                type="button"
                disabled={importing}
                onClick={async () => {
                  const res = await fetch(`/fixture-rosters/${file}`);
                  await finish(file, new Uint8Array(await res.arrayBuffer()));
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {importing && <p className="muted">Reading roster...</p>}
      {importError && <p className="error">{importError}</p>}
    </section>
  );
}
