import { can, isVendorUser, requireUser } from '@/lib/auth';
import { PageHead } from '@/components/ui';
import { DealForm } from '../DealForm';
import { formOptions } from '../formdata';

export default async function NewDeal() {
  const me = await requireUser();
  const vendor = isVendorUser(me);
  if (vendor ? !can(me, 'submit_deals') : !can(me, 'import_caissp')) return <PageHead title="New CAISSP deal" sub={`Your role (${me.role.name}) can’t create deals.`} />;
  const o = await formOptions(me);
  return (
    <>
      <PageHead title="New CAISSP deal" sub={vendor ? `Submitting for ${me.vendor!.name}. Enter one line per UPC, the same way as the CAISSP spreadsheet.` : 'Enter a CAISSP on a vendor’s behalf. Another approver has to decide on deals you enter.'} />
      <DealForm mode={vendor ? 'vendor' : 'retailer'} vendors={o.vendors} events={o.events} items={o.items} threshold={o.threshold} initial={{ header: vendor ? { broker: me.vendor!.broker ?? '', billingCompany: me.vendor!.name, salesperson: me.user.name, email: me.user.email } : {} }} />
    </>
  );
}
