import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Notice, errorMessage } from '../../components/ui/States';
import { TextField } from '../../components/ui/TextField';
import { useRegister } from './api';
import styles from './AuthLayout.module.css';

export function RegisterPage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    inviteCode: params.get('invite') ?? '',
    username: '',
    email: '',
    password: '',
  });
  const register = useRegister();
  const navigate = useNavigate();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    register.mutate(
      { ...form, username: form.username.trim(), email: form.email.trim(), inviteCode: form.inviteCode.trim() },
      { onSuccess: () => navigate('/', { replace: true }) },
    );
  }

  const err = register.error instanceof ApiError ? register.error : undefined;
  const hasFieldErrors = (err?.body?.fieldErrors.length ?? 0) > 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create an account</h1>
        <p className={styles.sub}>Registration needs an invite code from an admin.</p>
        {register.isError && !hasFieldErrors && <Notice>{errorMessage(register.error)}</Notice>}
        <form className={styles.form} onSubmit={submit} noValidate>
          <TextField
            label="Invite code"
            name="inviteCode"
            autoComplete="off"
            value={form.inviteCode}
            onChange={set('inviteCode')}
            error={err?.fieldError('inviteCode')}
            placeholder="ABCD-EFGH-JKMN"
            required
          />
          <TextField
            label="Username"
            name="username"
            autoComplete="username"
            value={form.username}
            onChange={set('username')}
            error={err?.fieldError('username')}
            hint="3 to 32 characters: letters, digits, '.', '_' or '-'"
            required
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            error={err?.fieldError('email')}
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={err?.fieldError('password')}
            hint="At least 10 characters"
            required
          />
          <Button type="submit" variant="primary" disabled={register.isPending}>
            {register.isPending ? 'Creating account' : 'Create account'}
          </Button>
        </form>
        <p className={styles.footer}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
