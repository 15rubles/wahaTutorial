import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useLogout, useMe } from '../../features/auth/api';
import { Button } from '../ui/Button';
import { StatusPill } from './StatusPill';
import styles from './AppShell.module.css';

export function AppShell() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          Muster
        </Link>
        <StatusPill />
        {me.data && (
          <nav className={styles.nav} aria-label="Account">
            <Link to="/" className={styles.navLink}>
              My lists
            </Link>
            {me.data.role === 'ADMIN' && (
              <Link to="/admin" className={styles.navLink}>
                Admin
              </Link>
            )}
            <span className={styles.user}>{me.data.username}</span>
            <Button
              variant="ghost"
              size="s"
              onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })}
            >
              Sign out
            </Button>
          </nav>
        )}
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
