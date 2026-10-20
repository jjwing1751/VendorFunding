/* Guided walkthroughs, one per built-in role. Steps tick themselves off when the user's own audit-trail
   actions match `auto`; any step can also be marked done by hand (useful when another tester already
   acted on the sample deal). Deal references are resolved to links at render time. */

export type GuideStep = {
  key: string;
  title: string;
  detail: string;
  href: string;          // where to do it
  deal?: string;         // deal number; when set, links to that deal instead of href
  cta: string;
  auto?: string[];       // audit actions by this user that complete the step
};
export type Guide = { goal: string; steps: GuideStep[] };

const GUIDES: Record<string, Guide> = {
  'Category manager': {
    goal: 'Work your deal queue for Salty Snacks, Candy, Breakfast and Center Store Meals: approve what passes, counter what’s underfunded, and make sure every promotion has funding behind it.',
    steps: [
      { key: 'queue', title: 'Start from your queue', detail: 'My work lists deals waiting on you in due-date order, plus events whose deal cutoff is close. Note which deals are overdue.', href: '/', cta: 'My work' },
      { key: 'approve', title: 'Approve a deal that passes every rule', detail: 'DL-0005 Big Game kettle chips scores 100. Check the three UPC lines, the Vendor funded label and the rule checks, then approve it with a short note.', href: '/deals', deal: 'DL-0005', cta: 'Open DL-0005', auto: ['Deal approved'] },
      { key: 'counter', title: 'Counter an underfunded deal', detail: 'DL-0004 Whole grain flakes: the vendor covers about 35% of the markdown against a 40% rule. Send it back with the suggested counter rate and say what you need.', href: '/deals', deal: 'DL-0004', cta: 'Open DL-0004', auto: ['Sent back with counter'] },
      { key: 'note', title: 'Leave an internal note', detail: 'On DL-0003 Holiday toffee tins, add a comment and tick “Internal”. Vendors never see internal notes; everyone at the retailer does.', href: '/deals', deal: 'DL-0003', cta: 'Open DL-0003', auto: ['Internal note added'] },
      { key: 'funding', title: 'Ask a vendor to fund a promotion', detail: 'Promotions & funding: PR-0003 Honey Oat 2 for $7 is retailer funded. Request funding from Bright Morning; it lands in their My work.', href: '/promotions', cta: 'Promotions', auto: ['Funding requested'] },
      { key: 'calendar', title: 'Check the funding picture', detail: 'On the 6-month calendar, find Holiday Entertaining. Green bars are vendor funded, amber shared, grey retailer funded.', href: '/calendar', cta: 'Calendar' },
      { key: 'perf', title: 'See how Back to School performed', detail: 'Funding & performance → Back to School: forecast vs actual lift, incremental margin, and how much of the funding was billed. Skillet meals (DL-0013) delivered about half its forecast lift and hasn’t been billed.', href: '/performance?w=past', cta: 'Performance' },
    ],
  },
  'Category director': {
    goal: 'Oversee every category: decide on rule exceptions, tune the approval rules, and set up and lock event plans.',
    steps: [
      { key: 'inbox', title: 'Scan the inbox across categories', detail: 'The Deal inbox shows every category, not just assigned ones. Sort by score and look at what the rules recommend.', href: '/deals', cta: 'Deal inbox' },
      { key: 'exception', title: 'Decide on a rule exception', detail: 'DL-0006 Greek yogurt passes on margin but Cedar Ridge’s compliance score (0.88) is below the 0.90 rule, so it needs a person. Approve with a note explaining why, or send it back.', href: '/deals', deal: 'DL-0006', cta: 'Open DL-0006', auto: ['Deal approved', 'Sent back with counter', 'Deal rejected'] },
      { key: 'rules', title: 'Tune an approval rule', detail: 'Approval rules: for example, lower the vendor share of markdown from 40% to 35%. Saving creates a new version; past decisions keep the version they were made under.', href: '/admin/rules', cta: 'Approval rules', auto: ['Rules changed'] },
      { key: 'event', title: 'Plan an event', detail: 'Event plans → New event: name, dates, vehicles, media spend and the vendor funding target.', href: '/events/new', cta: 'New event', auto: ['Event created'] },
      { key: 'lock', title: 'Lock an event plan', detail: 'Open the event you just created and lock it. Vendors can’t submit deals to a locked event, and the plan is released to production.', href: '/events', cta: 'Event plans', auto: ['Event plan locked'] },
      { key: 'scorecard', title: 'Compare vendors on the scorecard', detail: 'Vendor scorecards: committed vs collected, share of markdown, on-time submission and lift delivered. Blue Heron submitted after the cutoff; Bright Morning disputed its bill.', href: '/performance/vendors', cta: 'Scorecards' },
      { key: 'audit', title: 'Review decisions in the audit trail', detail: 'Find your decision and rule change, then verify the hash chain.', href: '/audit', cta: 'Audit trail' },
    ],
  },
  'Finance / AR': {
    goal: 'Make sure every dollar vendors committed is earned, billed through Bill Back Manager and collected, and that no accrual expires unbilled.',
    steps: [
      { key: 'funnel', title: 'Read the funding funnel', detail: 'Funding & performance: target → committed → earned on actual sales → billed → collected, for every event in the last six months.', href: '/performance', cta: 'Funding & performance' },
      { key: 'gaps', title: 'Find what hasn’t been billed', detail: 'Billing reconciliation: DL-0013 ended with nothing billed, DL-0011 billed only its ad fee, DL-0014 was over-billed and DL-0012 is disputed.', href: '/billing', cta: 'Billing' },
      { key: 'export', title: 'Send the ready-to-bill file to Bill Back Manager', detail: 'Export ready to bill: one row per deal with billable earned, already billed and the amount left to bill.', href: '/billing', cta: 'Billing', auto: ['Ready-to-bill file exported'] },
      { key: 'import', title: 'Import Bill Back Manager’s results', detail: 'Download the sample billing file (it bills everything in the ready-to-bill export), then import it on the Billing page. The deals move to Billed in full.', href: '/billing', cta: 'Billing', auto: ['Bill Back Manager file imported'] },
      { key: 'accrual', title: 'Chase an expiring accrual', detail: 'Accruals: Summit Home Care’s cleaner accrual (DL-0017) ended with most of its balance unbilled and the claim window closes in about two weeks.', href: '/accruals', cta: 'Accruals' },
      { key: 'sales', title: 'Upload a week of sales', detail: 'Sales & receipts data: download the sales template and upload it. Uploading the same UPC and week again replaces it.', href: '/data', cta: 'Data', auto: ['Sales data uploaded', 'Receipts data uploaded'] },
    ],
  },
  'Admin': {
    goal: 'Run the platform: people, roles, vendors and the integrity of the record. As a demo account you can manage only the users testers add, not real or built-in demo accounts.',
    steps: [
      { key: 'user', title: 'Add a user', detail: 'Users → Add a user: give them a role (and categories for a category manager). Copy the one-time temporary password; they must change it at first sign-in.', href: '/admin/users', cta: 'Users', auto: ['User added'] },
      { key: 'support', title: 'Support a user', detail: 'Open the user you just added and reset their password, reset two-step verification, or deactivate them. Each action signs them out.', href: '/admin/users', cta: 'Users', auto: ['Password reset', 'MFA reset', 'User deactivated', 'User unlocked'] },
      { key: 'roles', title: 'Change what a role can do', detail: 'Roles & permissions: for example, let Category managers approve over the cap, or require two-step verification for Vendor admins.', href: '/admin/roles', cta: 'Roles', auto: ['Role permissions changed', 'Role added'] },
      { key: 'vendor', title: 'Onboard a vendor', detail: 'Vendors: add a vendor with its number, category and settlement method (invoice or deduction).', href: '/admin/vendors', cta: 'Vendors', auto: ['Vendor added'] },
      { key: 'audit', title: 'Verify the audit trail', detail: 'Audit trail → Verify chain. Find your changes from the steps above; each entry is hashed into the one before it.', href: '/audit', cta: 'Audit trail' },
      { key: 'reset', title: 'Reset the demo between test sessions', detail: 'Demo accounts → Reset puts back the sample deals, roles and rules and restarts everyone’s walkthrough. Real users and the audit trail are kept.', href: '/admin/demo', cta: 'Demo accounts', auto: ['Demo data reset'] },
    ],
  },
  'Item setup': {
    goal: 'Keep the item master right. Deals can only be entered against UPCs that exist here.',
    steps: [
      { key: 'history', title: 'Look up a UPC’s history', detail: '0-85390-10011 (kettle chips sea salt) shows every deal and promotion that has touched it, with dates and funding.', href: '/items/0-85390-10011', cta: 'Open UPC' },
      { key: 'add', title: 'Add a new item', detail: 'Items by UPC → add a UPC with vendor, case pack, case cost, regular retail and baseline weekly units.', href: '/items', cta: 'Items', auto: ['Item added'] },
      { key: 'update', title: 'Update a cost', detail: 'Change the case cost on an existing UPC. The audit trail records the before and after values.', href: '/items', cta: 'Items', auto: ['Item updated'] },
    ],
  },
  'Analyst (read only)': {
    goal: 'See everything, change nothing: funding mix, deal economics and the audit record.',
    steps: [
      { key: 'calendar', title: 'Read the funding mix on the calendar', detail: 'Six months of events, deals and retailer promotions, colored by who pays.', href: '/calendar', cta: 'Calendar' },
      { key: 'economics', title: 'Read a deal’s economics', detail: 'DL-0001 Game Day kettle chips: deal case cost and net unit cost by UPC, vendor share of the markdown, and forecast lift.', href: '/deals', deal: 'DL-0001', cta: 'Open DL-0001' },
      { key: 'perf', title: 'Compare events', detail: 'Funding & performance: which completed events beat their forecast, and the return on their media spend.', href: '/performance?w=past', cta: 'Performance' },
      { key: 'promos', title: 'Find retailer-funded promotions', detail: 'Promotions & funding lists every promotion the retailer pays for itself, by UPC.', href: '/promotions', cta: 'Promotions' },
      { key: 'readonly', title: 'Confirm read-only access', detail: 'Open DL-0005: you see the rule checks and recommendation, but no approve, counter or reject buttons.', href: '/deals', deal: 'DL-0005', cta: 'Open DL-0005' },
      { key: 'audit', title: 'Verify the audit trail', detail: 'Audit trail → Verify chain confirms no entry has been altered.', href: '/audit', cta: 'Audit trail' },
    ],
  },
  'Vendor admin': {
    goal: 'Manage Prairie Gold Snacks’ team and submit CAISSP deals at the UPC level.',
    steps: [
      { key: 'work', title: 'See what the retailer needs', detail: 'My work shows events taking deals, their cutoff dates, and any funding requests from category managers.', href: '/', cta: 'My work' },
      { key: 'team', title: 'Add a teammate', detail: 'My team → add a Vendor user. Copy the temporary password; they set their own at first sign-in.', href: '/team', cta: 'My team', auto: ['User added'] },
      { key: 'draft', title: 'Enter a CAISSP deal by UPC', detail: 'New CAISSP deal for Holiday Entertaining: add the kettle chip UPCs with TPR and scan allowances and watch Total OI, deal case cost and net unit cost calculate. (Or upload your spreadsheet with Import CAISSP.)', href: '/deals/new', cta: 'New deal', auto: ['Deal drafted', 'CAISSP imported'] },
      { key: 'submit', title: 'Sign and submit', detail: 'Enter the signer and submit. A deal that passes every rule is approved automatically; anything else goes to the category manager.', href: '/deals', cta: 'My deals', auto: ['Deal submitted', 'Deal resubmitted'] },
      { key: 'comment', title: 'Message the category manager', detail: 'On DL-0005 Big Game kettle chips, add a comment, for example to confirm display timing.', href: '/deals', deal: 'DL-0005', cta: 'Open DL-0005', auto: ['Comment added'] },
      { key: 'funding', title: 'Check your funding and scorecard', detail: 'My funding & scorecard: what Prairie Gold committed, earned on actual sales, was billed and collected, and the lift your summer chips deal delivered.', href: '/performance/vendors', cta: 'My funding' },
    ],
  },
  'Vendor user': {
    goal: 'Respond to the retailer for Harvest Table Foods: answer a counter-offer and enter your next deal.',
    steps: [
      { key: 'find', title: 'Find the deal that needs you', detail: 'My work: DL-0007 Holiday stuffing was sent back with a counter-offer of $0.45 per unit.', href: '/', cta: 'My work' },
      { key: 'reply', title: 'Reply to the category manager', detail: 'On DL-0007, read the category manager’s note and add a comment.', href: '/deals', deal: 'DL-0007', cta: 'Open DL-0007', auto: ['Comment added'] },
      { key: 'counter', title: 'Accept the counter or revise', detail: 'Accept raises the scan allowance on each UPC to reach the counter rate and resubmits. Or edit the lines yourself and resubmit.', href: '/deals', deal: 'DL-0007', cta: 'Open DL-0007', auto: ['Counter accepted', 'Deal resubmitted'] },
      { key: 'draft', title: 'Start your next deal', detail: 'New CAISSP deal for New Year Reset with the skillet meal UPCs. Save it as a draft.', href: '/deals/new', cta: 'New deal', auto: ['Deal drafted', 'CAISSP imported'] },
      { key: 'funding', title: 'See what you’ll be billed', detail: 'My funding & scorecard: DL-0013 Skillet meals ended and is ready to bill. Open it to see units sold vs forecast and the billable amount.', href: '/performance/vendors', cta: 'My funding' },
    ],
  },
  'Vendor viewer': {
    goal: 'See Summit Home Care’s deals and dates without being able to change them.',
    steps: [
      { key: 'deals', title: 'See your company’s deals', detail: 'My deals lists every Summit Home Care deal and its status. Other vendors’ deals never appear.', href: '/deals', cta: 'My deals' },
      { key: 'readonly', title: 'Open a deal read-only', detail: 'DL-0008 Spring cleaner endcap is a draft. You can read the UPC lines and math but there is no Edit or Submit.', href: '/deals', deal: 'DL-0008', cta: 'Open DL-0008' },
      { key: 'calendar', title: 'Check promotion dates', detail: 'The calendar shows when your promotions run.', href: '/calendar', cta: 'Calendar' },
      { key: 'items', title: 'Check your items', detail: 'My items lists your UPCs with the cost and retail the retailer has on file.', href: '/items', cta: 'My items' },
    ],
  },
};

export const guideFor = (roleName: string): Guide | null => GUIDES[roleName] ?? null;
