import { NavLink, Outlet } from 'react-router-dom';
import styles from './Admin.module.css';

const tabs = [
  { to: '/admin/data', label: 'Data' },
  { to: '/admin/invites', label: 'Invites' },
];

export function AdminLayout() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Admin</h1>
      <nav className={styles.tabs} aria-label="Admin sections">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
