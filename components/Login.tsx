'use client';
import { useState } from 'react';
import { useApp } from './AppProvider';

export default function Login() {
  const { t, signIn } = useApp();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="wrap">
      <section className="login panel">
        <div className="brand-mark big"><span /></div>
        <h1>{t.loginT}</h1>
        {sent ? <p className="login-ok">{t.linkSent(sent)}</p> : <>
          <p>{t.loginSub}</p>
          <form onSubmit={async e => {
            e.preventDefault(); setBusy(true); setErr(null);
            const r = await signIn(email); setBusy(false);
            if (r) setErr(r); else setSent(email);
          }}>
            <label htmlFor="loginEmail" hidden>{t.email}</label>
            <input id="loginEmail" type="email" required className="select" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} />
            <button className="btn primary big" type="submit" disabled={busy}>{t.sendLink}</button>
          </form>
          {err && <p className="login-err">{err}</p>}
        </>}
      </section>
    </main>
  );
}
