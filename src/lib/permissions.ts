export type Org = 'RETAILER' | 'VENDOR';
export type Perm =
  | 'plan_events' | 'approve_deals' | 'all_categories' | 'approve_over_cap' | 'add_retail_promos' | 'import_caissp'
  | 'manage_items' | 'edit_rules' | 'view_audit' | 'manage_users'
  | 'view_performance' | 'manage_billing' | 'upload_actuals'
  | 'submit_deals' | 'manage_vendor_users' | 'view_own_funding';

export const PERMS: { key: Perm; org: Org; label: string }[] = [
  { key: 'plan_events', org: 'RETAILER', label: 'Plan events and lock event plans' },
  { key: 'approve_deals', org: 'RETAILER', label: 'Approve, counter or reject deals in assigned categories' },
  { key: 'all_categories', org: 'RETAILER', label: 'Act on every category, not only assigned ones' },
  { key: 'approve_over_cap', org: 'RETAILER', label: 'Approve deals above the auto-approval cap' },
  { key: 'add_retail_promos', org: 'RETAILER', label: 'Add retailer-funded promotions and request vendor funding' },
  { key: 'import_caissp', org: 'RETAILER', label: 'Import CAISSP spreadsheets for vendors' },
  { key: 'manage_items', org: 'RETAILER', label: 'Add and edit items (UPCs) in the item master' },
  { key: 'edit_rules', org: 'RETAILER', label: 'Change approval rules' },
  { key: 'view_audit', org: 'RETAILER', label: 'View and verify the audit trail' },
  { key: 'manage_users', org: 'RETAILER', label: 'Manage users, roles and vendors' },
  { key: 'view_performance', org: 'RETAILER', label: 'See funding, accruals, event performance and vendor scorecards' },
  { key: 'manage_billing', org: 'RETAILER', label: 'Import Bill Back Manager files and export deals ready to bill' },
  { key: 'upload_actuals', org: 'RETAILER', label: 'Upload sales and receipts data by UPC and week' },
  { key: 'submit_deals', org: 'VENDOR', label: 'Create, submit, revise and withdraw deals' },
  { key: 'manage_vendor_users', org: 'VENDOR', label: 'Add and remove users at their own company' },
  { key: 'view_own_funding', org: 'VENDOR', label: 'See their own funding, billing, accruals and scorecard' },
];

const ALL_RETAILER = PERMS.filter(p => p.org === 'RETAILER').map(p => p.key);

export const DEFAULT_ROLES: { name: string; org: Org; permissions: Perm[]; requireMfa: boolean }[] = [
  { name: 'Admin', org: 'RETAILER', permissions: ALL_RETAILER, requireMfa: true },
  { name: 'Category director', org: 'RETAILER', permissions: ['plan_events', 'approve_deals', 'all_categories', 'approve_over_cap', 'add_retail_promos', 'import_caissp', 'edit_rules', 'view_audit', 'view_performance'], requireMfa: false },
  { name: 'Category manager', org: 'RETAILER', permissions: ['plan_events', 'approve_deals', 'add_retail_promos', 'import_caissp', 'view_audit', 'view_performance'], requireMfa: false },
  { name: 'Finance / AR', org: 'RETAILER', permissions: ['all_categories', 'view_audit', 'view_performance', 'manage_billing', 'upload_actuals'], requireMfa: false },
  { name: 'Item setup', org: 'RETAILER', permissions: ['manage_items'], requireMfa: false },
  { name: 'Analyst (read only)', org: 'RETAILER', permissions: ['view_audit', 'view_performance', 'all_categories'], requireMfa: false },
  { name: 'Vendor admin', org: 'VENDOR', permissions: ['submit_deals', 'manage_vendor_users', 'view_own_funding'], requireMfa: false },
  { name: 'Vendor user', org: 'VENDOR', permissions: ['submit_deals', 'view_own_funding'], requireMfa: false },
  { name: 'Vendor viewer', org: 'VENDOR', permissions: ['view_own_funding'], requireMfa: false },
];

export function permLabel(k: string) {
  return PERMS.find(p => p.key === k)?.label ?? k;
}

/** Permissions added after the first release, granted once to existing built-in roles on upgrade (seed step). */
export const PERMS_V2: Partial<Record<string, Perm[]>> = {
  'Admin': ['view_performance', 'manage_billing', 'upload_actuals'],
  'Category director': ['view_performance'], 'Category manager': ['view_performance'], 'Analyst (read only)': ['view_performance', 'all_categories'],
  'Vendor admin': ['view_own_funding'], 'Vendor user': ['view_own_funding'], 'Vendor viewer': ['view_own_funding'],
};
