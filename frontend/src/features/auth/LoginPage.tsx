import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Notice, errorMessage } from '../../components/ui/States';
import { TextField } from '../../components/ui/TextField';
import { useLogin } from './api';
import { safeNext } from './guards';
import styles from './AuthLayout.module.css';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  function submit(e: FormEvent) {
    e.preventDefault();
    login.mutate(
      { username: username.trim(), password },
      { onSuccess: () => navigate(safeNext(params.get('next')), { replace: true }) },
    );
  }

  const err = login.error instanceof ApiError ? login.error : undefined;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in</h1>
        {login.isError && <Notice>{errorMessage(login.error)}</Notice>}
        <form className={styles.form} onSubmit={submit} noValidate>
          <TextField
            label="Username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={err?.fieldError('username')}
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={err?.fieldError('password')}
            required
          />
          <Button type="submit" variant="primary" disabled={login.isPending || !username || !password}>
            {login.isPending ? 'Signing in' : 'Sign in'}
          </Button>
        </form>
        <p className={styles.footer}>
          Got an invite code? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
