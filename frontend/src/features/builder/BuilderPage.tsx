import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState, LoadingState, Notice, errorMessage } from '../../components/ui/States';
import { ExportDialog } from '../export/ExportDialog';
import { KeywordPopupProvider } from '../keywords/KeywordPopupProvider';
import { useBattleSizes, useDetachments, useFactionConfig, useForceDispositions } from '../game/api';
import { useRoster, useRosterMutations } from '../rosters/api';
import { AddUnitsPane } from './AddUnitsPane';
import { BuilderHeader } from './BuilderHeader';
import { ConfigPanel } from './ConfigPanel';
import { DataBanner } from './DataBanner';
import { DetailsPane } from './DetailsPane';
import { MobileLayout } from './MobileLayout';
import { Panes } from './Panes';
import { useIsMobile } from '../../lib/useMediaQuery';
import { useSavePrefs } from './prefs';
import { RosterSections } from './RosterSections';
import { useBuilderUi } from './store';
import { useAvailableDatasheets } from './useAvailableDatasheets';
import styles from './builder.module.css';

export function BuilderPage() {
  const id = Number(useParams().id);
  const roster = useRoster(id);
  const r = roster.data;
  const version = r?.version.rosterVersion;
  const config = useFactionConfig(r?.factionKey, version);
  const detachments = useDetachments(r?.factionKey, version);
  const sizes = useBattleSizes(version);
  const dispositions = useForceDispositions(version);
  const sheets = useAvailableDatasheets(r);
  const m = useRosterMutations(id);
  const select = useBuilderUi((s) => s.select);
  const savePrefs = useSavePrefs();
  const [exportOpen, setExportOpen] = useState(false);
  const mobile = useIsMobile();

  useEffect(() => {
    select(null);
    if (Number.isFinite(id)) savePrefs({ lastRosterId: id });
  }, [id]);

  if (!Number.isFinite(id)) return <ErrorState error={new Error('Not a valid list')} />;
  if (roster.isPending) return <LoadingState label="Loading list" />;
  if (roster.isError || !r) return <ErrorState error={roster.error} />;

  const sizeName = sizes.data?.find((b) => b.key === r.battleSizeKey)?.name;
  const mutationError = [m.addEntry, m.config].find((x) => x.isError)?.error;

  return (
    <KeywordPopupProvider version={version}>
    <div className={styles.builder}>
      <BuilderHeader
        key={r.name}
        roster={r}
        battleSizeName={sizeName}
        onRename={(name) => m.config.mutate({ name })}
        onExport={() => setExportOpen(true)}
      />
      <DataBanner roster={r} />
      {mutationError && <Notice>{errorMessage(mutationError)}</Notice>}
      {exportOpen && <ExportDialog rosterId={r.id} onClose={() => setExportOpen(false)} />}
      {(() => {
        const add = sheets.isPending ? (
          <LoadingState />
        ) : (
          <AddUnitsPane roster={r} datasheets={sheets.data} adding={m.addEntry.isPending} onAdd={(key) => m.addEntry.mutate({ datasheetKey: key })} />
        );
        const list = (
          <div className={styles.listBody}>
            <ConfigPanel
              roster={r}
              battleSizes={sizes.data ?? []}
              config={config.data}
              detachments={detachments.data ?? []}
              dispositions={dispositions.data ?? []}
              defaultOpen={!mobile && (r.detachments.length === 0 || r.entries.length === 0)}
            />
            <RosterSections roster={r} datasheets={sheets.data} />
          </div>
        );
        const details = <DetailsPane roster={r} detachments={detachments.data ?? []} />;
        return mobile ? <MobileLayout add={add} list={list} details={details} /> : <Panes add={add} list={list} details={details} />;
      })()}
    </div>
    </KeywordPopupProvider>
  );
}
