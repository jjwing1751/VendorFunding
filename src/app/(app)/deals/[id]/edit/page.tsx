import { notFound } from 'next/navigation';
import { isVendorUser, requireUser } from '@/lib/auth';
import { loadDeal } from '@/lib/data';
import { PageHead } from '@/components/ui';
import { DealForm } from '../../DealForm';
import { formOptions } from '../../formdata';

export default async function EditDeal({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const d = await loadDeal((await params).id);
  if (!d || (isVendorUser(me) && me.vendor?.id !== d.vendorId)) notFound();
  const o = await formOptions(me);
  return (
    <>
      <PageHead title={`Edit ${d.number}`} sub={d.status === 'SENT_BACK' ? `Sent back${d.counterRate ? ` with a $${d.counterRate.toFixed(2)}/unit counter` : ''}: ${d.decisionNote ?? ''}` : 'Draft. Save, review the checks, then submit.'} />
      <DealForm mode={isVendorUser(me) ? 'vendor' : 'retailer'} vendors={o.vendors} events={o.events} items={o.items} threshold={o.threshold} dealId={d.id}
        initial={{ vendorId: d.vendorId, eventId: d.eventId, title: d.title, header: d.header as Record<string, string>, periods: d.periods as Record<string, { start: string; end: string }>, storeGroups: d.storeGroups, adFee: d.adFee, accrualPct: d.accrualPct, forecastUnits: d.forecastUnits, signer: d.signer,
          lines: d.lines.map(l => ({ upc: l.upc, cmap: l.cmap, tpr: l.tpr, ad: l.ad, billBack: l.billBack, wholesalerScan: l.wholesalerScan, retailerScan: l.retailerScan, zone3Retail: l.zone3Retail, zone4Retail: l.zone4Retail, zone5Retail: l.zone5Retail, loyaltyMulti: l.loyaltyMulti })) }} />
    </>
  );
}
