import { can, isVendorUser, requireUser } from '@/lib/auth';
import { PageHead } from '@/components/ui';
import { formOptions } from '../formdata';
import { ImportForm } from './ImportForm';

export default async function ImportPage() {
  const me = await requireUser();
  const vendor = isVendorUser(me);
  if (vendor ? !can(me, 'submit_deals') : !can(me, 'import_caissp')) return <PageHead title="Import CAISSP" sub={`Your role (${me.role.name}) can’t import CAISSPs.`} />;
  const o = await formOptions(me);
  return (
    <>
      <PageHead title="Import CAISSP" sub="Upload the CAISSP spreadsheet as it is. Fundline reads the header, allowance periods, store groups and every UPC line, recalculates deal case cost and net unit cost, and saves a draft for review." />
      <section className="panel"><div className="panel-b"><ImportForm vendors={o.vendors} events={o.events} /></div></section>
      <section className="panel"><div className="panel-h"><h2>What gets read</h2></div><div className="panel-b small">
        <p style={{ marginTop: 0 }}>The sheet named “CAISSP” (or any sheet with an “Individual item UPC Code” column). Header labels such as Vendor Number, Vendor/Broker, Promotion, Ad Fee and AIM Contract Number. Start and end dates for AMAP, TPR, Ad, Bill Back, wholesaler unit scan and unit scan. Item columns for CMAP/AMAP, TPR, Ad deal, Bill Back, unit scans and the zone retails.</p>
        <p style={{ marginBottom: 0 }}>Description, case pack, case cost and regular retail come from the item master, not the file. UPCs that are not set up are skipped and listed so you can add them.</p>
      </div></section>
    </>
  );
}
