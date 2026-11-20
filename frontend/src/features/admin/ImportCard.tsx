import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Notice, errorMessage } from '../../components/ui/States';
import { useImport, type ImportSource } from './dataApi';
import styles from './Admin.module.css';

type Props = { source: ImportSource; title: string; accept: string; help: string };

export function ImportCard({ source, title, accept, help }: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const run = useImport(source);

  return (
    <section className={styles.card} aria-labelledby={`${inputId}-h`}>
      <h3 id={`${inputId}-h`} className={styles.cardTitle}>
        {title}
      </h3>
      <p className={styles.muted}>{help}</p>
      <div className={styles.toolbar}>
        <label htmlFor={inputId} className="sr-only">
          {title} file
        </label>
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          accept={accept}
          className={styles.file}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button
          variant="primary"
          disabled={!file || run.isPending}
          onClick={() =>
            file &&
            run.mutate(file, {
              onSuccess: () => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = '';
              },
            })
          }
        >
          {run.isPending ? 'Importing' : 'Import'}
        </Button>
      </div>
      {run.isError && <Notice>{errorMessage(run.error)}</Notice>}
      {run.data && (
        <Notice tone="ok">
          <span>
            Draft version <span className="num">{run.data.versionId}</span> built with{' '}
            <span className="num">{run.data.version.entities}</span> entities.{' '}
            <Link to={`/admin/data/versions/${run.data.versionId}`}>Review the report</Link>
          </span>
        </Notice>
      )}
    </section>
  );
}
