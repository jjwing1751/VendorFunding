'use client';
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const msg = error.message && !error.message.includes('digest') && error.message.length < 300 ? error.message : 'Something went wrong.';
  return <section className="panel"><div className="panel-b form"><h1>That didn’t work</h1><p>{process.env.NODE_ENV === 'production' && error.digest ? 'Something went wrong. Try again, and tell your admin if it keeps happening.' : msg}</p><p className="hint">Reference: {error.digest ?? 'n/a'}</p><div><button className="btn" onClick={reset}>Try again</button></div></div></section>;
}
