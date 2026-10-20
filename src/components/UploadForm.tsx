'use client';
import { useActionState } from 'react';
import type { UploadState } from '@/app/(app)/data/actions';

export function UploadForm({ action, kinds, button, id }: { action: (s: UploadState, f: FormData) => Promise<UploadState>; kinds?: { value: string; label: string }[]; button: string; id: string }) {
  const [state, run, pending] = useActionState<UploadState, FormData>(action, undefined);
  return (
    <form action={run} className="form">
      <div className="fgrid">
        {kinds && <div className="field"><label htmlFor={`${id}-kind`}>What’s in the file</label><select id={`${id}-kind`} name="kind">{kinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>}
        <div className="field"><label htmlFor={`${id}-file`}>CSV file (up to 5 MB)</label><input id={`${id}-file`} name="file" type="file" accept=".csv,.txt,.tsv,text/csv" required /></div>
      </div>
      <div><button className="btn primary" disabled={pending}>{pending ? 'Loading…' : button}</button></div>
      {state && <div className={`flash ${state.ok ? 'ok' : 'err'}`} role={state.ok ? 'status' : 'alert'}>
        <div>{state.message}</div>
        {state.problems && state.problems.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{state.problems.map((p, i) => <li key={i} className="small">{p}</li>)}</ul>}
      </div>}
    </form>
  );
}
