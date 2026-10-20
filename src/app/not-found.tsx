import Link from 'next/link';
export default function NotFound() { return <main className="auth"><div className="card"><h1>Not found</h1><p className="muted">That page doesn’t exist or you don’t have access to it.</p><Link className="btn" href="/">Go to My work</Link></div></main>; }
