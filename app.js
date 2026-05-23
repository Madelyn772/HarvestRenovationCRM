import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { portalConfig } from './config.js';

const config = portalConfig || {};
const state = {
  supabase: null,
  session: null,
  profile: null,
  crmStoreKey: '',
  currentTab: 'dashboard',
  dashboardViewMode: 'admin',
  unsavedForms: new Set(),
  allowTabSwitch: false,
  teamProfiles: [],
  pendingUsers: [],
  crmBindingsReady: false,
  portalSettings: {
    company_calendar_name: config.companyCalendarName || 'Harvest Renovation Company Calendar',
    company_calendar_embed_url: config.companyCalendarEmbedUrl || ''
  }
};

const el = {};
const STORAGE_KEY = 'harvest-portal-pro-crm-v1';
const DASHBOARD_VIEW_MODE_KEY = 'harvest-portal-pro-dashboard-view-mode';
const PHONE_MAP_KEY = 'harvest-portal-profile-phone-map-v1';

const estimateTemplates = {
  'Kitchen Remodeling': {
    trade: 'Kitchen Remodeling',
    measurementType: 'SquareFoot',
    rate: 28,
    materialPercent: 12,
    laborPercent: 18,
    finalPercent: 8,
    scope: 'Cabinet updates, countertops, backsplash, paint, trim, lighting, and finish work.'
  },
  'Bathroom Remodeling': {
    trade: 'Bathroom Remodeling',
    measurementType: 'SquareFoot',
    rate: 30,
    materialPercent: 12,
    laborPercent: 18,
    finalPercent: 8,
    scope: 'Tile, vanity, trim, paint, plumbing coordination, and fixture installation.'
  },
  Flooring: {
    trade: 'Flooring',
    measurementType: 'SquareFoot',
    rate: 6,
    materialPercent: 10,
    laborPercent: 15,
    finalPercent: 8,
    scope: 'Demo, prep, flooring install, trim reset, transitions, and cleanup.'
  },
  Painting: {
    trade: 'Painting',
    measurementType: 'SquareFoot',
    rate: 2.5,
    materialPercent: 10,
    laborPercent: 15,
    finalPercent: 8,
    scope: 'Prep, patch, caulk, prime as needed, paint, and cleanup.'
  },
  'Drywall / Framing / Electrical': {
    trade: 'Drywall / Framing / Electrical',
    measurementType: 'LinearFoot',
    rate: 24,
    materialPercent: 10,
    laborPercent: 15,
    finalPercent: 8,
    scope: 'Framing adjustments, drywall patch/finish, outlet or fixture support, and cleanup.'
  },
  'Full Home Renovation': {
    trade: 'Full Home Renovation',
    measurementType: 'SquareFoot',
    rate: 40,
    materialPercent: 12,
    laborPercent: 20,
    finalPercent: 10,
    scope: 'Multi-room renovation including planning, finishes, trade coordination, and punch list.'
  }
};

const seedData = {
  clients: [
    {
      id: 'CL-1',
      name: 'Greg G.',
      phone: '(832) 555-1122',
      email: 'greg@example.com',
      serviceArea: 'Houston 77089',
      address: '123 Sample St, Houston, TX',
      source: 'Referral',
      tags: 'Kitchen, repeat potential',
      notes: 'Warm client. Likes fast communication.'
    },
    {
      id: 'CL-2',
      name: 'Kat G.',
      phone: '(832) 555-4590',
      email: 'kat@example.com',
      serviceArea: 'South Houston 77587',
      address: '456 Example Ave, South Houston, TX',
      source: 'Google',
      tags: 'Electrical',
      notes: 'Electrical work. Great review candidate.'
    }
  ],
  leads: [
    {
      id: 'L-1',
      clientId: 'CL-1',
      clientName: 'Greg G.',
      phone: '(832) 555-1122',
      email: 'greg@example.com',
      service: 'Kitchen Remodeling',
      area: 'Houston 77089',
      status: 'Estimate Scheduled',
      preferredDate: addDaysISO(1),
      notes: 'Cabinet update and flooring refresh.'
    },
    {
      id: 'L-2',
      clientId: 'CL-2',
      clientName: 'Kat G.',
      phone: '(832) 555-4590',
      email: 'kat@example.com',
      service: 'Drywall / Framing / Electrical',
      area: 'South Houston 77587',
      status: 'Estimate Sent',
      preferredDate: addDaysISO(3),
      notes: 'Electrical panel and outlet work. Follow up Friday.'
    }
  ],
  estimates: [
    {
      id: 'EID-1',
      clientId: 'CL-2',
      estimateNumber: 'E5800816',
      date: todayISO(),
      user: 'Kat G.',
      trade: 'Electrical',
      measurementType: 'LinearFoot',
      rate: 28,
      quantity: 16,
      materialCost: 650,
      materialPercent: 10,
      pricingMode: 'labor',
      laborPercent: 15,
      finalPercent: 0,
      depositPercent: 30,
      laborBase: 448,
      materialMarkup: 65,
      laborMarkup: 67.2,
      finalPay: 0,
      estimatedCost: 1180.2,
      depositAmount: 354.06,
      useLaborPercent: true,
      scope: 'Panel update, patio outlets, and RV outlets.',
      status: 'Sent',
      value: 1180.2
    }
  ],
  jobs: [
    { id: 'J-1', clientId: 'CL-1', client: 'Greg G.', service: 'Kitchen Remodeling', status: 'Scheduled', value: 4200, startDate: addDaysISO(5), notes: 'Confirm paint color + final walkthrough.' },
    { id: 'J-2', clientId: 'CL-2', client: 'Kat G.', service: 'Electrical', status: 'In Progress', value: 1180.2, startDate: todayISO(), notes: 'Install outlets and cleanup.' }
  ],
  calendar: [
    { id: 'C-1', clientId: 'CL-1', title: 'Kitchen estimate visit', date: todayISO(), type: 'Estimate Visit', client: 'Greg G.', notes: 'Bring samples and measure island.' },
    { id: 'C-2', clientId: 'CL-2', title: 'Invoice follow-up', date: addDaysISO(2), type: 'Invoice Follow-up', client: 'Kat G.', notes: 'Check if payment link was received.' }
  ],
  notes: [
    { id: 'N-1', clientId: 'CL-1', title: 'Greg G.', category: 'Before Photos', link: '', body: 'Use this note area for measurements, selections, and photo links.' }
  ],
  invoices: [
    {
      id: 'INV-1',
      clientId: 'CL-2',
      relatedEstimate: 'EID-1',
      invoiceNumber: 'V7349927',
      date: todayISO(),
      clientName: 'Kat G.',
      address: '456 Example Ave, South Houston, TX',
      phone: '(832) 555-4590',
      email: 'kat@example.com',
      status: 'Draft',
      items: [{ description: 'Electrical work deposit', amount: 354.06 }],
      total: 354.06
    }
  ],
  trash: [],
  activity: [
    { id: 'A-1', text: 'Imported workbook-style estimate and invoice structure into the portal workflow.', meta: 'System setup', date: todayISO() },
    { id: 'A-2', text: 'Seeded client autofill records for Greg G. and Kat G.', meta: 'Client database', date: todayISO() }
  ]
};

let store = loadStore();
let selectedClientId = null;
let toastTimerId = 0;

function cloneSeedStore() {
  return JSON.parse(JSON.stringify(seedData));
}

function crmStorageKeyForUser(userId = '') {
  const normalized = String(userId || '').trim();
  return normalized ? `${STORAGE_KEY}-${normalized}` : `${STORAGE_KEY}-guest`;
}

function normalizeStoreShape(raw) {
  const base = cloneSeedStore();
  if (!raw || typeof raw !== 'object') return base;
  const keys = ['clients', 'leads', 'estimates', 'jobs', 'calendar', 'notes', 'invoices', 'trash', 'activity'];
  keys.forEach(key => {
    base[key] = Array.isArray(raw[key]) ? raw[key] : base[key];
  });
  return base;
}

function loadStoreFromKey(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return normalizeStoreShape(JSON.parse(raw));
  } catch {
    return null;
  }
}

function loadStore() {
  const scopedKey = crmStorageKeyForUser(state.session?.user?.id || state.profile?.id);
  const scoped = loadStoreFromKey(scopedKey);
  if (scoped) {
    state.crmStoreKey = scopedKey;
    return scoped;
  }

  const legacy = loadStoreFromKey(STORAGE_KEY);
  if (legacy) {
    state.crmStoreKey = scopedKey;
    try {
      localStorage.setItem(scopedKey, JSON.stringify(legacy));
    } catch {
      // Ignore blocked storage contexts.
    }
    return legacy;
  }

  state.crmStoreKey = scopedKey;
  return cloneSeedStore();
}

function saveStore() {
  const key = state.crmStoreKey || crmStorageKeyForUser(state.session?.user?.id || state.profile?.id);
  state.crmStoreKey = key;
  try {
    localStorage.setItem(key, JSON.stringify(store));
  } catch {
    // Ignore blocked storage contexts.
  }
}

function switchStoreToUserScope(userId) {
  const nextKey = crmStorageKeyForUser(userId);
  if (state.crmStoreKey === nextKey) return;

  const existingScopedStore = loadStoreFromKey(nextKey);
  if (existingScopedStore) {
    state.crmStoreKey = nextKey;
    store = existingScopedStore;
    return;
  }

  state.crmStoreKey = nextKey;
  saveStore();
}

function safeExternalHref(value = '') {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    const parsed = new URL(input, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function noteLinkMarkup(linkValue) {
  const href = safeExternalHref(linkValue);
  if (!href) return '';
  return `<div><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Open file link</a></div>`;
}

function qs(id) {
  return document.getElementById(id);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function showAuthMessage(message, type = 'info') {
  el.authMessage.textContent = message;
  el.authMessage.className = `auth-message ${type}`;
  el.authMessage.classList.remove('hidden');
}

function clearAuthMessage() {
  el.authMessage.className = 'auth-message hidden';
  el.authMessage.textContent = '';
}

function updateSaveStateChip(text = 'Connected') {
  if (el.saveStateChip) el.saveStateChip.textContent = text;
}

function showToast(message, type = 'info', timeoutMs = 2800) {
  const stack = qs('toastStack');
  if (!stack || !message) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  window.clearTimeout(toastTimerId);
  toastTimerId = window.setTimeout(() => {
    toast.remove();
  }, timeoutMs);
}

function bindDynamicTabLinks(root = document) {
  qsa('[data-open-tab]', root).forEach(btn => {
    if (btn.dataset.boundOpenTab === '1') return;
    btn.dataset.boundOpenTab = '1';
    btn.addEventListener('click', () => openTab(btn.dataset.openTab));
  });
}

function shouldWarnUnsaved(targetTabId) {
  const next = targetTabId || '';
  if (state.allowTabSwitch) return false;
  if (state.unsavedForms.size === 0) return false;
  const safeTargets = new Set(['settings', 'admin']);
  if (safeTargets.has(next) && state.currentTab === next) return false;
  return true;
}

function confirmTabSwitch(targetTabId) {
  if (!shouldWarnUnsaved(targetTabId)) return true;
  const proceed = window.confirm('You have unsaved changes. Leave this section anyway?');
  if (proceed) state.unsavedForms.clear();
  return proceed;
}

function markFormDirty(form) {
  if (!form?.id) return;
  state.unsavedForms.add(form.id);
}

function clearFormDirty(form) {
  if (!form?.id) return;
  state.unsavedForms.delete(form.id);
}

function setSetupBanner(message = '') {
  if (!message) {
    el.setupBanner.classList.add('hidden');
    el.setupBanner.textContent = '';
    return;
  }
  el.setupBanner.textContent = message;
  el.setupBanner.classList.remove('hidden');
}

function openTab(tabId) {
  if (!confirmTabSwitch(tabId)) return;

  const tabConfig = {
    dashboard: { nav: 'dashboard', panels: ['dashboard'], title: ['Dashboard', 'Run clients, estimates, projects, invoices, and shared team operations in one portal.'] },
    crm: {
      nav: 'crm',
      panels: ['clients'],
      subnav: [
        ['clients', 'Clients'],
        ['leads', 'Leads'],
        ['documents', 'Notes & Files'],
        ['trash', 'Trash']
      ],
      title: ['CRM', 'Manage clients, leads, notes, and recovery tools from one category.']
    },
    clients: {
      nav: 'crm',
      panels: ['clients'],
      subnav: [
        ['clients', 'Clients'],
        ['leads', 'Leads'],
        ['documents', 'Notes & Files'],
        ['trash', 'Trash']
      ],
      title: ['CRM', 'Manage clients, leads, notes, and recovery tools from one category.'],
      activeSubtab: 'clients'
    },
    leads: {
      nav: 'crm',
      panels: ['leads'],
      subnav: [
        ['clients', 'Clients'],
        ['leads', 'Leads'],
        ['documents', 'Notes & Files'],
        ['trash', 'Trash']
      ],
      title: ['CRM', 'Manage clients, leads, notes, and recovery tools from one category.'],
      activeSubtab: 'leads'
    },
    documents: {
      nav: 'crm',
      panels: ['documents'],
      subnav: [
        ['clients', 'Clients'],
        ['leads', 'Leads'],
        ['documents', 'Notes & Files'],
        ['trash', 'Trash']
      ],
      title: ['CRM', 'Manage clients, leads, notes, and recovery tools from one category.'],
      activeSubtab: 'documents'
    },
    trash: {
      nav: 'crm',
      panels: ['trash'],
      subnav: [
        ['clients', 'Clients'],
        ['leads', 'Leads'],
        ['documents', 'Notes & Files'],
        ['trash', 'Trash']
      ],
      title: ['CRM', 'Manage clients, leads, notes, and recovery tools from one category.'],
      activeSubtab: 'trash'
    },
    estimating: {
      nav: 'estimating',
      panels: ['estimates'],
      subnav: [
        ['estimates', 'Estimates'],
        ['projects', 'Projects'],
        ['invoices', 'Invoices']
      ],
      title: ['Workflow', 'Build estimates, manage projects, and create invoices from one workflow.']
    },
    estimates: {
      nav: 'estimating',
      panels: ['estimates'],
      subnav: [
        ['estimates', 'Estimates'],
        ['projects', 'Projects'],
        ['invoices', 'Invoices']
      ],
      title: ['Workflow', 'Build estimates, manage projects, and create invoices from one workflow.'],
      activeSubtab: 'estimates'
    },
    projects: {
      nav: 'estimating',
      panels: ['projects'],
      subnav: [
        ['estimates', 'Estimates'],
        ['projects', 'Projects'],
        ['invoices', 'Invoices']
      ],
      title: ['Workflow', 'Build estimates, manage projects, and create invoices from one workflow.'],
      activeSubtab: 'projects'
    },
    jobs: {
      nav: 'estimating',
      panels: ['projects'],
      subnav: [
        ['estimates', 'Estimates'],
        ['projects', 'Projects'],
        ['invoices', 'Invoices']
      ],
      title: ['Workflow', 'Build estimates, manage projects, and create invoices from one workflow.'],
      activeSubtab: 'projects'
    },
    invoices: {
      nav: 'estimating',
      panels: ['invoices'],
      subnav: [
        ['estimates', 'Estimates'],
        ['projects', 'Projects'],
        ['invoices', 'Invoices']
      ],
      title: ['Workflow', 'Build estimates, manage projects, and create invoices from one workflow.'],
      activeSubtab: 'invoices'
    },
    calendars: {
      nav: 'calendars',
      panels: ['calendar'],
      subnav: [
        ['calendar', 'Schedule'],
        ['company-calendar', 'Company Calendar'],
        ['team-calendars', 'Employee Calendars']
      ],
      title: ['Calendars', 'Switch between scheduling, company events, and employee calendars.']
    },
    employees: {
      nav: 'employees',
      panels: ['employees'],
      title: ['Employees', 'Contact active employees by email and view shared profile details.']
    },
    calendar: {
      nav: 'calendars',
      panels: ['calendar'],
      subnav: [
        ['calendar', 'Schedule'],
        ['company-calendar', 'Company Calendar'],
        ['team-calendars', 'Employee Calendars']
      ],
      title: ['Calendars', 'Switch between scheduling, company events, and employee calendars.'],
      activeSubtab: 'calendar'
    },
    'company-calendar': {
      nav: 'calendars',
      panels: ['company-calendar'],
      subnav: [
        ['calendar', 'Schedule'],
        ['company-calendar', 'Company Calendar'],
        ['team-calendars', 'Employee Calendars']
      ],
      title: ['Calendars', 'Switch between scheduling, company events, and employee calendars.'],
      activeSubtab: 'company-calendar'
    },
    'team-calendars': {
      nav: 'calendars',
      panels: ['team-calendars'],
      subnav: [
        ['calendar', 'Schedule'],
        ['company-calendar', 'Company Calendar'],
        ['team-calendars', 'Employee Calendars']
      ],
      title: ['Calendars', 'Switch between scheduling, company events, and employee calendars.'],
      activeSubtab: 'team-calendars'
    },
    settings: { nav: 'settings', panels: ['settings'], title: ['Settings', 'Manage your profile, calendar visibility, and password.'] },
    admin: { nav: 'admin', panels: ['admin'], title: ['Admin', 'Approve or deny new user access requests.'] }
  };

  const config = tabConfig[tabId] || tabConfig.dashboard;
  state.currentTab = config.nav === 'dashboard' ? 'dashboard' : tabId;

  qsa('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === config.nav));
  qsa('.panel').forEach(panel => panel.classList.toggle('active', config.panels.includes(panel.id)));

  const subnav = qs('sectionSubnav');
  if (config.subnav?.length) {
    const activeSubtab = config.activeSubtab || config.panels[0];
    subnav.innerHTML = config.subnav.map(([id, label]) => `
      <button type="button" class="section-subnav-btn ${id === activeSubtab ? 'active' : ''}" data-open-tab="${id}">${escapeHtml(label)}</button>
    `).join('');
    subnav.classList.remove('hidden');
    bindDynamicTabLinks(subnav);
  } else {
    subnav.innerHTML = '';
    subnav.classList.add('hidden');
  }

  subnav.classList.toggle('sticky', config.nav === 'calendars');

  qsa('[data-hero-target]').forEach(button => {
    button.classList.toggle('active', button.dataset.heroTarget === config.nav);
  });

  el.pageTitle.textContent = config.title?.[0] || 'Dashboard';
  el.pageSubtitle.textContent = config.title?.[1] || '';
  updateDashboardViewToggle();
}

function updateDashboardViewToggle() {
  if (!el.dashboardViewToggleBtn) return;
  const showToggle = isAdmin() && state.currentTab === 'dashboard';
  el.dashboardViewToggleBtn.classList.toggle('hidden', !showToggle);
  el.dashboardViewToggleBtn.textContent = state.dashboardViewMode === 'staff' ? 'Admin View' : 'Staff View';
}

function dashboardViewStorageKey() {
  const userId = state.profile?.id || 'unknown';
  return `${DASHBOARD_VIEW_MODE_KEY}-${userId}`;
}

function loadDashboardViewMode() {
  try {
    const value = localStorage.getItem(dashboardViewStorageKey());
    return value === 'staff' || value === 'admin' ? value : 'admin';
  } catch {
    return 'admin';
  }
}

function saveDashboardViewMode() {
  if (!isAdmin()) return;
  try {
    localStorage.setItem(dashboardViewStorageKey(), state.dashboardViewMode);
  } catch {
    // Ignore localStorage write issues (private mode or blocked storage).
  }
}

function setAuthView(view) {
  qsa('.auth-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.authView === view));
  el.loginForm.classList.toggle('active', view === 'login');
  el.signupForm.classList.toggle('active', view === 'signup');
  el.loginForm.classList.toggle('hidden', view !== 'login');
  el.signupForm.classList.toggle('hidden', view !== 'signup');
  clearAuthMessage();
}

function showShell(shell) {
  el.authShell.classList.add('hidden');
  el.pendingShell.classList.add('hidden');
  el.appShell.classList.add('hidden');
  if (shell === 'auth') el.authShell.classList.remove('hidden');
  if (shell === 'pending') el.pendingShell.classList.remove('hidden');
  if (shell === 'app') el.appShell.classList.remove('hidden');
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getRoleLabel(role = 'staff') {
  return role.replace(/_/g, ' ');
}

function isAdmin() {
  return state.profile?.role === 'admin' && state.profile?.status === 'active';
}

async function safeRpc(functionName, params = {}) {
  const { data, error } = await state.supabase.rpc(functionName, params);
  if (error) throw error;
  return data;
}

async function bootstrap() {
  captureElements();
  bindBaseEvents();

  const publishableKey = config.supabasePublishableKey || config.supabaseAnonKey || '';
  const missingConfig = !config.supabaseUrl || !publishableKey;
  if (missingConfig) {
    setSetupBanner('Setup required: add your Supabase URL and publishable key in config.js before using this portal.');
    showAuthMessage('This bundle is production-ready, but it still needs your live Supabase project credentials in config.js.', 'info');
    showShell('auth');
    return;
  }

  state.supabase = createClient(config.supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });


  try {
    initCrmFeatures();
  } catch (error) {
    console.error(error);
    showToast('CRM startup issue detected. Authentication is still available.', 'error');
  }
  const { data: sessionData } = await state.supabase.auth.getSession();
  state.session = sessionData.session;

  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    if (!session) {
      state.profile = null;
      showShell('auth');
      return;
    }
    await loadAuthenticatedApp();
  });

  if (state.session) {
    await loadAuthenticatedApp();
  } else {
    showShell('auth');
  }
}

function captureElements() {
  Object.assign(el, {
    setupBanner: qs('setupBanner'),
    authShell: qs('authShell'),
    pendingShell: qs('pendingShell'),
    appShell: qs('appShell'),
    authMessage: qs('authMessage'),
    loginForm: qs('loginForm'),
    signupForm: qs('signupForm'),
    pageTitle: qs('pageTitle'),
    pageSubtitle: qs('pageSubtitle'),
    sidebarUserName: qs('sidebarUserName'),
    sidebarUserMeta: qs('sidebarUserMeta'),
    sidebarRole: qs('sidebarRole'),
    authStatusChip: qs('authStatusChip'),
    saveStateChip: qs('saveStateChip'),
    calendarStatusChip: qs('calendarStatusChip'),
    sectionSubnav: qs('sectionSubnav'),
    dashboardViewToggleBtn: qs('dashboardViewToggleBtn'),
    navCountCrm: qs('navCountCrm'),
    navCountCalendars: qs('navCountCalendars'),
    navCountAdmin: qs('navCountAdmin'),
    statsGrid: qs('statsGrid'),
    readinessList: qs('readinessList'),
    calendarGuide: qs('calendarGuide'),
    companyCalendarWrap: qs('companyCalendarWrap'),
    companyCalendarBadge: qs('companyCalendarBadge'),
    teamCalendarList: qs('teamCalendarList'),
    employeeSearch: qs('employeeSearch'),
    employeeList: qs('employeeList'),
    profileForm: qs('profileForm'),
    passwordForm: qs('passwordForm'),
    companyCalendarForm: qs('companyCalendarForm'),
    adminSettings: qs('adminSettings'),
    pendingList: qs('pendingList'),
    pendingBadge: qs('pendingBadge'),
    openUserDirectoryBtn: qs('openUserDirectoryBtn'),
    adminPendingView: qs('adminPendingView'),
    adminUserView: qs('adminUserView'),
    showPendingApprovalsBtn: qs('showPendingApprovalsBtn'),
    adminViewModeLabel: qs('adminViewModeLabel'),
    adminUserList: qs('adminUserList'),
    adminUserBadge: qs('adminUserBadge'),
    adminGrantAccessForm: qs('adminGrantAccessForm'),
    pendingTitle: qs('pendingTitle'),
    pendingBody: qs('pendingBody'),
    refreshProfileBtn: qs('refreshProfileBtn'),
    logoutPendingBtn: qs('logoutPendingBtn'),
    logoutBtn: qs('logoutBtn')
  });
}

function bindBaseEvents() {
  qsa('.auth-tab').forEach(tab => tab.addEventListener('click', () => setAuthView(tab.dataset.authView)));
  qsa('.nav-btn').forEach(btn => btn.addEventListener('click', () => openTab(btn.dataset.tab)));
  bindDynamicTabLinks();
  initUnsavedChangeTracking();
  qs('openSettingsPanelBtn').addEventListener('click', () => openTab('settings'));
  if (el.dashboardViewToggleBtn) {
    el.dashboardViewToggleBtn.addEventListener('click', () => {
      state.dashboardViewMode = state.dashboardViewMode === 'staff' ? 'admin' : 'staff';
      saveDashboardViewMode();
      updateDashboardViewToggle();
      renderDashboard();
    });
  }
  el.refreshProfileBtn.addEventListener('click', async () => {
    await loadAuthenticatedApp(true);
  });
  el.logoutPendingBtn.addEventListener('click', async () => {
    if (!state.supabase) return;
    await state.supabase.auth.signOut();
  });
  el.logoutBtn.addEventListener('click', async () => {
    await state.supabase.auth.signOut();
  });
  el.loginForm.addEventListener('submit', handleLogin);
  el.signupForm.addEventListener('submit', handleSignup);
  el.profileForm.addEventListener('submit', handleProfileSave);
  if (el.employeeSearch) el.employeeSearch.addEventListener('input', renderEmployees);
  el.passwordForm.addEventListener('submit', handlePasswordChange);
  el.companyCalendarForm.addEventListener('submit', handleCompanyCalendarSave);
  if (el.openUserDirectoryBtn) {
    el.openUserDirectoryBtn.addEventListener('click', () => {
      setAdminPrimaryView('users');
    });
  }
  if (el.showPendingApprovalsBtn) {
    el.showPendingApprovalsBtn.addEventListener('click', () => {
      setAdminPrimaryView('pending');
    });
  }
  if (el.adminGrantAccessForm) {
    el.adminGrantAccessForm.addEventListener('submit', handleAdminGrantAccess);
  }
  setAdminPrimaryView('pending');
}

function initUnsavedChangeTracking() {
  qsa('form').forEach(form => {
    form.addEventListener('input', () => markFormDirty(form));
    form.addEventListener('change', () => markFormDirty(form));
    form.addEventListener('submit', () => clearFormDirty(form));
  });

  window.addEventListener('beforeunload', event => {
    if (state.unsavedForms.size === 0) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

async function handleLogin(event) {
  event.preventDefault();
  if (!state.supabase) {
    showAuthMessage('Supabase is not initialized. Check config.js and refresh the page.', 'error');
    return;
  }
  clearAuthMessage();
  const fd = new FormData(el.loginForm);
  const email = String(fd.get('email') || '').trim();
  const password = String(fd.get('password') || '');
  updateSaveStateChip('Signing in…');
  const { error } = await state.supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    updateSaveStateChip('Auth error');
    const normalizedMessage = String(error.message || '').toLowerCase();
    if (normalizedMessage.includes('invalid login credentials')) {
      showAuthMessage('Login failed: check email/password and try again. If this account was deactivated, ask an admin to reactivate it.', 'error');
      return;
    }
    if (normalizedMessage.includes('email not confirmed')) {
      showAuthMessage('Login blocked: this email is not confirmed yet. Confirm the email first or disable email confirmation in Supabase Auth settings.', 'error');
      return;
    }
    showAuthMessage(error.message, 'error');
    return;
  }
  updateSaveStateChip('Authenticated');
}

async function handleSignup(event) {
  event.preventDefault();
  clearAuthMessage();
  const fd = new FormData(el.signupForm);
  const email = String(fd.get('email') || '').trim();
  const password = fd.get('password');
  const confirmPassword = fd.get('confirm_password');
  if (password !== confirmPassword) {
    showAuthMessage('Passwords do not match.', 'error');
    return;
  }
  if (String(password).length < 10) {
    showAuthMessage('Password must be at least 10 characters.', 'error');
    return;
  }
  updateSaveStateChip('Submitting request…');
  const { data, error } = await state.supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fd.get('full_name')
      }
    }
  });
  if (error) {
    updateSaveStateChip('Request failed');
    showAuthMessage(error.message, 'error');
    return;
  }

  const autoApprovedEmails = (config.bootstrapUsers || []).map(item => String(item.email || '').toLowerCase());
  const isBootstrapEmail = autoApprovedEmails.includes(email.toLowerCase());
  const msg = isBootstrapEmail
    ? 'Account request submitted. This email is on the bootstrap list, so it should become active automatically when the database trigger is installed.'
    : 'Account request created. An administrator must approve your access before you can enter the portal.';

  updateSaveStateChip('Request created');
  showAuthMessage(msg, 'success');
  el.signupForm.reset();
  setAuthView('login');
  if (data?.session) await loadAuthenticatedApp(true);
}

async function loadAuthenticatedApp(forceRefresh = false) {
  if (!state.session) {
    showShell('auth');
    return;
  }

  try {
    state.profile = await fetchMyProfile();
    if (!state.profile) {
      showShell('auth');
      showAuthMessage('Your profile is not available yet. If you just signed up, wait a few seconds and try again.', 'info');
      return;
    }

    if (state.profile.status === 'pending') {
      el.pendingTitle.textContent = 'Your account is pending approval';
      el.pendingBody.textContent = 'An admin must approve your account before you can access the portal. Click refresh after you have been approved.';
      showShell('pending');
      return;
    }

    if (state.profile.status === 'denied') {
      el.pendingTitle.textContent = 'Your account was denied';
      el.pendingBody.textContent = 'This account is currently blocked. Contact the portal administrator if you need access restored.';
      showShell('pending');
      return;
    }

    switchStoreToUserScope(state.profile.id);

    await Promise.all([
      loadTeamProfiles(),
      loadPortalSettings(forceRefresh),
      isAdmin() ? loadPendingUsers() : Promise.resolve([])
    ]);

    hydrateShell();
    renderAll();
    renderCompanyCalendar();
    renderTeamCalendars();
    renderPendingUsers();
    renderAdminUsers();
    showShell('app');
    openTab('dashboard');
    updateSaveStateChip('Synced');
  } catch (error) {
    console.error(error);
    showAuthMessage(error.message || 'Something went wrong loading the portal.', 'error');
    showShell('auth');
  }
}

async function fetchMyProfile() {
  const { data, error } = await state.supabase
    .from('profiles')
    .select('*')
    .eq('id', state.session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadTeamProfiles() {
  const { data, error } = await state.supabase
    .from('profiles')
    .select('*')
    .eq('status', 'active')
    .order('email', { ascending: true });
  if (error) throw error;
  state.teamProfiles = (data || [])
    .map(profile => ({
      ...profile,
      full_name: profile.full_name || profile.fullName || profile.name || profile.email || 'User',
      phone: profile.phone || getStoredPhone(profile.id)
    }))
    .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), undefined, { sensitivity: 'base' }));
}

async function loadPortalSettings(forceRefresh = false) {
  if (!forceRefresh && !state.supabase) return;
  const { data, error } = await state.supabase
    .from('portal_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.warn('portal_settings unavailable, using config fallback', error.message);
    return;
  }
  if (data) {
    state.portalSettings = {
      company_calendar_name: data.company_calendar_name || state.portalSettings.company_calendar_name,
      company_calendar_embed_url: data.company_calendar_embed_url || state.portalSettings.company_calendar_embed_url
    };
  }
}

async function loadPendingUsers() {
  if (!isAdmin()) return [];
  try {
    state.pendingUsers = await safeRpc('list_pending_profiles');
  } catch (error) {
    console.warn('Pending users rpc unavailable', error.message);
    state.pendingUsers = [];
  }
  return state.pendingUsers;
}

function hydrateShell() {
  el.sidebarUserName.textContent = state.profile.full_name || state.profile.email || 'User';
  el.sidebarUserMeta.textContent = `${state.profile.email} • ${state.profile.status}`;
  el.sidebarRole.textContent = getRoleLabel(state.profile.role || 'staff');
  el.authStatusChip.textContent = `${getRoleLabel(state.profile.role || 'staff')} • ${state.profile.status}`;
  el.calendarStatusChip.textContent = state.portalSettings.company_calendar_embed_url ? 'Configured' : 'Not configured';

  el.profileForm.full_name.value = state.profile.full_name || '';
  el.profileForm.email.value = state.profile.email || state.session.user.email || '';
  el.profileForm.phone.value = state.profile.phone || getStoredPhone(state.profile.id) || '';
  el.profileForm.google_calendar_embed_url.value = state.profile.google_calendar_embed_url || '';
  el.profileForm.calendar_label.value = state.profile.calendar_label || '';

  el.companyCalendarForm.company_calendar_name.value = state.portalSettings.company_calendar_name || '';
  el.companyCalendarForm.company_calendar_embed_url.value = state.portalSettings.company_calendar_embed_url || '';

  qsa('.admin-only').forEach(node => node.classList.toggle('hidden', !isAdmin()));
  el.adminSettings.classList.toggle('hidden', !isAdmin());
  if (isAdmin()) {
    state.dashboardViewMode = loadDashboardViewMode();
  } else {
    state.dashboardViewMode = 'admin';
  }
  updateDashboardViewToggle();
}

function renderDashboard() {
  const openLeads = store.leads.filter(item => !['Won', 'Lost'].includes(item.status)).length;
  const activeEstimates = store.estimates.filter(item => ['Draft', 'Sent', 'Approved'].includes(item.status)).length;
  const activeJobs = store.jobs.filter(item => ['Estimate', 'Scheduled', 'In Progress', 'On Hold'].includes(item.status)).length;
  const activeUsers = state.teamProfiles.length;
  const teamCalendars = state.teamProfiles.filter(item => item.google_calendar_embed_url).length;
  const showAdminDashboardCards = isAdmin() && state.dashboardViewMode !== 'staff';
  const pipeline = [...store.estimates.filter(item => item.status !== 'Rejected'), ...store.jobs.filter(item => item.status !== 'Completed')]
    .reduce((sum, item) => sum + Number(item.value || item.estimatedCost || 0), 0);
  const stats = showAdminDashboardCards
    ? [
      ['Approved Employees', activeUsers, 'Visible inside the portal'],
      ['Team Calendars Added', teamCalendars, 'Employees sharing Google calendars'],
      ['Company Calendar', state.portalSettings.company_calendar_embed_url ? 'Live' : 'Pending', 'Shared embed configuration'],
      ['Admin', `${(state.pendingUsers || []).length} pending`, 'Approval dashboard access'],
      ['Password Security', 'Enabled', 'Users can update their own password', true]
    ]
    : [
      ['Active Clients', store.clients.length, 'Master records'],
      ['Open Leads', openLeads, 'Need follow-up'],
      ['Estimates', activeEstimates, 'Draft / sent / approved'],
      ['Active Projects', activeJobs, 'Scheduled or in progress'],
      ['Pipeline Value', currency(pipeline), 'Open estimate + job value', true]
    ];
  el.statsGrid.innerHTML = stats.map(([label, value, note, warm]) => `
    <article class="stat ${warm ? 'warm' : ''}">
      <span class="label">${escapeHtml(label)}</span>
      <strong class="value">${escapeHtml(String(value))}</strong>
      <div class="muted">${escapeHtml(note)}</div>
    </article>
  `).join('');

  const priorities = [
    `${openLeads} open lead(s) need follow-up`,
    `${store.calendar.filter(item => item.date === todayISO()).length} calendar item(s) are scheduled today`,
    'Create or select a client before starting a new estimate',
    'Use Trash instead of permanent delete when something is entered by mistake',
    'Convert approved estimates into invoices to avoid double entry'
  ];
  qs('priorityChecklist').innerHTML = priorities.map(item => `<li class="item">✅ ${escapeHtml(item)}</li>`).join('');

  const recs = [
    'Add change orders in the production version so scope changes are tracked cleanly.',
    'Add real PDF export and direct email sending from the final portal.',
    'Add deposit received, amount paid, and balance due tracking on invoices.',
    'Connect follow-up reminders to estimate status and invoice status.',
    'Keep company and team calendars updated so schedule context stays visible.'
  ];
  qs('recommendations').innerHTML = recs.map(item => `<div class="feed-item">${escapeHtml(item)}</div>`).join('');

  const recent = store.activity.slice().reverse().slice(0, 8);
  qs('activityFeed').innerHTML = recent.length
    ? recent.map(item => `<div class="feed-item"><strong>${escapeHtml(item.text)}</strong><div class="muted">${escapeHtml(item.meta)} • ${escapeHtml(item.date)}</div></div>`).join('')
    : '<div class="feed-item">No activity yet.</div>';

  const upcoming = store.calendar.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  qs('upcomingFeed').innerHTML = upcoming.length
    ? upcoming.map(item => `<div class="feed-item"><strong>${escapeHtml(item.title)}</strong><div>${escapeHtml(item.date)} • ${escapeHtml(item.type)}</div><div class="muted">${escapeHtml(item.client || '')}</div></div>`).join('')
    : '<div class="feed-item">No upcoming events yet.</div>';

  renderNavCounts();
}

function renderNavCounts() {
  const scheduledEstimateCount = store.leads.filter(item => item.status === 'Estimate Scheduled').length;
  const upcomingCalendarCount = store.calendar.filter(item => item.date && item.date >= todayISO()).length;
  const pendingAdminCount = isAdmin() ? (state.pendingUsers || []).length : 0;

  const setCount = (node, count) => {
    if (!node) return;
    node.textContent = String(count);
    node.classList.toggle('hidden', count <= 0);
  };

  setCount(el.navCountCrm, scheduledEstimateCount);
  setCount(el.navCountCalendars, upcomingCalendarCount);
  setCount(el.navCountAdmin, pendingAdminCount);
}

function renderCompanyCalendar() {
  const url = state.portalSettings.company_calendar_embed_url;
  const name = state.portalSettings.company_calendar_name || 'Company Calendar';
  if (!url) {
    el.companyCalendarBadge.textContent = 'Awaiting setup';
    el.companyCalendarWrap.className = 'calendar-embed-shell empty-state';
    el.companyCalendarWrap.innerHTML = 'Add the shared Google Calendar embed URL in configuration or in the admin portal settings.';
    return;
  }
  el.companyCalendarBadge.textContent = name;
  el.companyCalendarWrap.className = 'calendar-embed-shell';
  el.companyCalendarWrap.innerHTML = `<iframe class="calendar-frame" src="${escapeHtml(url)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
}

function renderTeamCalendars() {
  if (!state.teamProfiles.length) {
    el.teamCalendarList.innerHTML = '<div class="feed-item">No approved employees are available yet.</div>';
    return;
  }

  const html = state.teamProfiles.map(profile => {
    const mine = profile.id === state.profile.id;
    const calendarLabel = profile.calendar_label || `${profile.full_name || profile.email} calendar`;
    const statusText = profile.google_calendar_embed_url ? 'Calendar visible to team' : 'Calendar not added yet';
    return `
      <div class="calendar-card">
        <div class="card-head tight">
          <div>
            <p class="eyebrow">${mine ? 'Your calendar' : 'Employee calendar'}</p>
            <h3>${escapeHtml(profile.full_name || profile.email)}</h3>
          </div>
          <span class="badge">${escapeHtml(getRoleLabel(profile.role || 'staff'))}</span>
        </div>
        <div class="calendar-meta">
          <div>${escapeHtml(calendarLabel)}</div>
          <div>${escapeHtml(statusText)}</div>
          <div>Joined ${escapeHtml(formatDate(profile.created_at))}</div>
        </div>
        ${profile.google_calendar_embed_url ? `<div class="form-actions"><button class="ghost-btn" data-toggle-calendar="${escapeHtml(profile.id)}">Show calendar</button></div><div class="calendar-slot hidden" id="calendar-slot-${escapeHtml(profile.id)}"><iframe class="calendar-frame" src="${escapeHtml(profile.google_calendar_embed_url)}" loading="lazy"></iframe></div>` : '<div class="feed-item" style="margin-top:12px;">This employee has not shared a Google Calendar embed link yet.</div>'}
      </div>
    `;
  }).join('');

  el.teamCalendarList.innerHTML = html;
  qsa('[data-toggle-calendar]').forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.toggleCalendar;
      const slot = qs(`calendar-slot-${targetId}`);
      if (!slot) return;
      const hidden = slot.classList.toggle('hidden');
      button.textContent = hidden ? 'Show calendar' : 'Hide calendar';
    });
  });
}

function renderPendingUsers() {
  if (!isAdmin()) return;
  const pending = state.pendingUsers || [];
  el.pendingBadge.textContent = `${pending.length} pending`;
  if (!pending.length) {
    el.pendingList.innerHTML = '<div class="feed-item">No pending requests right now.</div>';
    return;
  }
  el.pendingList.innerHTML = pending.map(item => `
    <div class="request-card">
      <div class="form-actions" style="justify-content:space-between; align-items:flex-start;">
        <div>
          <strong>${escapeHtml(item.full_name || item.email)}</strong>
          <div class="request-meta">
            <span>${escapeHtml(item.email)}</span>
            <span>Requested ${escapeHtml(formatDate(item.created_at))}</span>
          </div>
        </div>
        <span class="status-pill pending">Pending</span>
      </div>
      <div class="form-actions">
        <button class="primary-btn" data-review-user="approve:${escapeHtml(item.id)}">Approve</button>
        <button class="danger-btn" data-review-user="deny:${escapeHtml(item.id)}">Deny</button>
      </div>
    </div>
  `).join('');
  qsa('[data-review-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [decision, userId] = btn.dataset.reviewUser.split(':');
      await reviewPendingUser(userId, decision);
    });
  });
}

function setAdminPrimaryView(view = 'pending') {
  const isUsersView = view === 'users';
  if (el.adminPendingView) el.adminPendingView.classList.toggle('hidden', isUsersView);
  if (el.adminUserView) el.adminUserView.classList.toggle('hidden', !isUsersView);
  if (el.openUserDirectoryBtn) {
    el.openUserDirectoryBtn.classList.toggle('active', isUsersView);
    el.openUserDirectoryBtn.setAttribute('aria-pressed', String(isUsersView));
  }
  if (el.showPendingApprovalsBtn) {
    el.showPendingApprovalsBtn.classList.toggle('active', !isUsersView);
    el.showPendingApprovalsBtn.setAttribute('aria-pressed', String(!isUsersView));
  }
  if (el.adminViewModeLabel) {
    el.adminViewModeLabel.textContent = isUsersView ? 'Viewing user directory' : 'Viewing pending approvals';
  }
}

function renderAdminUsers() {
  if (!isAdmin() || !el.adminUserList) return;
  const users = (state.teamProfiles || []).slice().sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));
  if (el.adminUserBadge) el.adminUserBadge.textContent = `${users.length} active`;

  if (!users.length) {
    el.adminUserList.innerHTML = '<div class="feed-item">No active users found. Pending approvals will appear after access is granted.</div>';
    return;
  }

  el.adminUserList.innerHTML = users.map(user => {
    const isSelf = user.id === state.profile.id;
    return `
      <div class="user-card">
        <div>
          <strong>${escapeHtml(user.full_name || user.email)}</strong>
          <div class="user-meta">
            <div>${escapeHtml(user.email || '')}</div>
            <div>Role: ${escapeHtml(getRoleLabel(user.role || 'staff'))}</div>
            <div>Status: ${escapeHtml(user.status || 'active')}</div>
            <div>Joined ${escapeHtml(formatDate(user.created_at))}</div>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="danger-btn" data-deactivate-user="${escapeHtml(user.id)}" ${isSelf ? 'disabled' : ''}>Deactivate</button>
        </div>
      </div>
    `;
  }).join('');

  qsa('[data-deactivate-user]').forEach(button => {
    button.addEventListener('click', async () => {
      const userId = button.dataset.deactivateUser;
      await deactivateUser(userId);
    });
  });
}

async function deactivateUser(userId) {
  if (!isAdmin() || !userId) return;
  if (userId === state.profile?.id) {
    showToast('You cannot deactivate your own account from this panel.', 'error');
    return;
  }
  const confirmed = window.confirm('Deactivate this user and remove their access?');
  if (!confirmed) return;

  try {
    updateSaveStateChip('Deactivating user…');
    await safeRpc('review_user_request', {
      p_user_id: userId,
      p_decision: 'deny',
      p_role: 'staff'
    });

    await loadPendingUsers();
    await loadTeamProfiles();
    renderDashboard();
    renderPendingUsers();
    renderTeamCalendars();
    renderAdminUsers();
    updateSaveStateChip('User deactivated');
    showToast('User deactivated successfully.', 'success');
  } catch (error) {
    console.error(error);
    updateSaveStateChip('Admin action failed');
    showToast(error.message || 'Unable to deactivate this user.', 'error');
  }
}

async function handleAdminGrantAccess(event) {
  event.preventDefault();
  if (!isAdmin()) return;

  const fd = new FormData(el.adminGrantAccessForm);
  const fullName = String(fd.get('full_name') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  const phone = String(fd.get('phone') || '').trim();

  if (!fullName || !email || !password) {
    showToast('Name, email, and password are required.', 'error');
    return;
  }
  if (password.length < 10) {
    showToast('Password must be at least 10 characters.', 'error');
    return;
  }

  const adminSession = state.session;
  let createdUserId = '';

  try {
    updateSaveStateChip('Creating user access…');

    const { data, error } = await state.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw error;

    createdUserId = data?.user?.id || data?.session?.user?.id || '';

    if (adminSession?.access_token && adminSession?.refresh_token) {
      const { error: restoreError } = await state.supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });
      if (restoreError) throw restoreError;
      const { data: sessionData } = await state.supabase.auth.getSession();
      state.session = sessionData.session;
    }

    if (!createdUserId) {
      await loadPendingUsers();
      const pendingMatch = (state.pendingUsers || []).find(item => String(item.email || '').toLowerCase() === email);
      createdUserId = pendingMatch?.id || '';
    }

    if (!createdUserId) {
      throw new Error('User was created, but approval target could not be resolved.');
    }

    await safeRpc('review_user_request', {
      p_user_id: createdUserId,
      p_decision: 'approve',
      p_role: 'staff'
    });

    if (phone) {
      try {
        await safeRpc('set_user_phone', {
          p_user_id: createdUserId,
          p_phone: phone
        });
      } catch {
        setStoredPhone(createdUserId, phone);
      }
    }

    await loadPendingUsers();
    await loadTeamProfiles();
    renderDashboard();
    renderPendingUsers();
    renderTeamCalendars();
    renderEmployees();
    renderAdminUsers();
    el.adminGrantAccessForm.reset();
    clearFormDirty(el.adminGrantAccessForm);
    updateSaveStateChip('Access granted');
    showToast(`Access granted for ${fullName}.`, 'success');
  } catch (error) {
    console.error(error);
    updateSaveStateChip('Grant access failed');
    showToast(error.message || 'Unable to grant access for this user.', 'error');
  }
}

async function reviewPendingUser(userId, decision) {
  try {
    updateSaveStateChip('Updating access…');
    await safeRpc('review_user_request', {
      p_user_id: userId,
      p_decision: decision,
      p_role: 'staff'
    });
    await loadPendingUsers();
    await loadTeamProfiles();
    renderDashboard();
    renderPendingUsers();
    renderTeamCalendars();
    renderAdminUsers();
    updateSaveStateChip('Access updated');
    showToast(`User ${decision === 'approve' ? 'approved' : 'denied'}.`, 'success');
  } catch (error) {
    console.error(error);
    updateSaveStateChip('Admin action failed');
    showToast(error.message || 'Unable to update user access.', 'error');
  }
}

async function handleProfileSave(event) {
  event.preventDefault();
  try {
    updateSaveStateChip('Saving profile…');
    const fd = new FormData(el.profileForm);
    const phone = String(fd.get('phone') || '').trim();
    const payload = {
      p_full_name: fd.get('full_name'),
      p_google_calendar_embed_url: fd.get('google_calendar_embed_url') || null,
      p_calendar_label: fd.get('calendar_label') || null,
      p_phone: phone || null
    };
    try {
      await safeRpc('update_my_profile', payload);
    } catch (error) {
      const errorMessage = String(error?.message || '').toLowerCase();
      const legacyFunctionMismatch = errorMessage.includes('update_my_profile') && (errorMessage.includes('does not exist') || errorMessage.includes('function') || errorMessage.includes('signature'));
      if (!legacyFunctionMismatch) throw error;
      await safeRpc('update_my_profile', {
        p_full_name: payload.p_full_name,
        p_google_calendar_embed_url: payload.p_google_calendar_embed_url,
        p_calendar_label: payload.p_calendar_label
      });
    }
    state.profile = await fetchMyProfile();
    state.profile.phone = phone || state.profile.phone || '';
    setStoredPhone(state.profile.id, phone);
    await loadTeamProfiles();
    hydrateShell();
    renderDashboard();
    renderTeamCalendars();
    renderEmployees();
    renderAdminUsers();
    clearFormDirty(el.profileForm);
    updateSaveStateChip('Profile saved');
    showToast('Profile updated.', 'success');
  } catch (error) {
    console.error(error);
    updateSaveStateChip('Profile save failed');
    showToast(error.message || 'Unable to save your profile.', 'error');
  }
}

async function handlePasswordChange(event) {
  event.preventDefault();
  const fd = new FormData(el.passwordForm);
  const password = fd.get('password');
  const confirmPassword = fd.get('confirm_password');
  if (password !== confirmPassword) {
    showToast('Passwords do not match.', 'error');
    return;
  }
  if (String(password).length < 10) {
    showToast('Use at least 10 characters for the new password.', 'error');
    return;
  }
  try {
    updateSaveStateChip('Updating password…');
    const { error } = await state.supabase.auth.updateUser({ password });
    if (error) throw error;
    el.passwordForm.reset();
    clearFormDirty(el.passwordForm);
    updateSaveStateChip('Password updated');
    showToast('Password updated successfully.', 'success');
  } catch (error) {
    console.error(error);
    updateSaveStateChip('Password update failed');
    showToast(error.message || 'Unable to update password.', 'error');
  }
}

async function handleCompanyCalendarSave(event) {
  event.preventDefault();
  if (!isAdmin()) return;
  const fd = new FormData(el.companyCalendarForm);
  try {
    updateSaveStateChip('Saving company calendar…');
    await safeRpc('update_company_calendar_settings', {
      p_company_calendar_name: fd.get('company_calendar_name') || 'Harvest Renovation Company Calendar',
      p_company_calendar_embed_url: fd.get('company_calendar_embed_url') || null
    });
    await loadPortalSettings(true);
    hydrateShell();
    renderDashboard();
    renderCompanyCalendar();
    clearFormDirty(el.companyCalendarForm);
    updateSaveStateChip('Company calendar saved');
    showToast('Company calendar settings updated.', 'success');
  } catch (error) {
    console.error(error);
    updateSaveStateChip('Calendar save failed');
    showToast(error.message || 'Unable to save company calendar settings.', 'error');
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function currency(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function generateCode(prefix, existingCodes = []) {
  const usedNumbers = new Set(
    existingCodes
      .map(code => String(code || '').trim())
      .filter(code => code.startsWith(prefix))
      .map(code => Number.parseInt(code.slice(prefix.length), 10))
      .filter(Number.isFinite)
  );

  let nextNumber = 1000000;
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }

  return `${prefix}${String(nextNumber).padStart(7, '0')}`;
}

function createId(prefix = 'ID') {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${randomPart}`;
}

function addActivity(text, meta = 'System') {
  if (!store?.activity || !Array.isArray(store.activity)) return;
  store.activity.unshift({
    id: createId('A'),
    text,
    meta,
    date: todayISO()
  });
  if (store.activity.length > 200) {
    store.activity = store.activity.slice(0, 200);
  }
}

function findClientById(clientId) {
  return store.clients.find(item => item.id === clientId) || null;
}

function findEstimateById(estimateId) {
  return store.estimates.find(item => item.id === estimateId) || null;
}

function duplicateClients({ name = '', phone = '', email = '' }) {
  const normalizedName = normalize(name);
  const normalizedPhone = normalize(phone);
  const normalizedEmail = normalize(email);
  return store.clients.filter(client => {
    return (normalizedName && normalize(client.name) === normalizedName)
      || (normalizedPhone && normalize(client.phone) === normalizedPhone)
      || (normalizedEmail && normalize(client.email) === normalizedEmail);
  });
}

function ensureClientRecord({ name, phone = '', email = '', area = '', address = '', source = '', tags = '', notes = '' }) {
  const duplicate = duplicateClients({ name, phone, email })[0];
  if (duplicate) {
    duplicate.name = duplicate.name || name;
    duplicate.phone = duplicate.phone || phone;
    duplicate.email = duplicate.email || email;
    duplicate.serviceArea = duplicate.serviceArea || area;
    duplicate.address = duplicate.address || address;
    duplicate.source = duplicate.source || source;
    duplicate.tags = duplicate.tags || tags;
    duplicate.notes = duplicate.notes || notes;
    return duplicate;
  }
  const client = {
    id: createId('CL'),
    name,
    phone,
    email,
    serviceArea: area,
    address,
    source,
    tags,
    notes
  };
  store.clients.push(client);
  addActivity(`Client ${name} created.`, 'Clients');
  return client;
}

function calculateEstimate(data) {
  const rate = Number(data.rate || 0);
  const quantity = Number(data.quantity || 0);
  const materialCost = Number(data.materialCost || 0);
  const materialPercent = Number(data.materialPercent || 0);
  const laborPercent = Number(data.laborPercent || 0);
  const finalPercent = Number(data.finalPercent || 0);
  const depositPercent = Number(data.depositPercent || 0);
  const useLaborPercent = data.pricingMode === 'labor';

  if (materialCost < 400 && materialPercent < 5) throw new Error('Material percent must be at least 5% when material cost is under $400.');
  if (materialCost >= 400 && materialPercent < 10) throw new Error('Material percent must be at least 10% when material cost is $400 or more.');
  if (useLaborPercent && laborPercent < 10) throw new Error('Labor percent must be at least 10%.');
  if (!useLaborPercent && finalPercent < 1) throw new Error('Final percent must be at least 1%.');

  const laborBase = rate * quantity;
  const materialMarkup = materialCost * (materialPercent / 100);
  let laborMarkup = 0;
  let finalPay = 0;
  let estimatedCost = 0;

  if (useLaborPercent) {
    laborMarkup = laborBase * (laborPercent / 100);
    estimatedCost = laborBase + materialCost + materialMarkup + laborMarkup;
  } else {
    const subtotal = laborBase + materialCost + materialMarkup;
    finalPay = subtotal * (finalPercent / 100);
    estimatedCost = subtotal + finalPay;
  }

  const depositAmount = estimatedCost * (depositPercent / 100);
  const balanceAfterDeposit = estimatedCost - depositAmount;

  return { laborBase, materialMarkup, laborMarkup, finalPay, estimatedCost, depositAmount, balanceAfterDeposit, useLaborPercent };
}

function statusClass(status = '') {
  return normalize(status).replace(/\s+/g, '');
}

function renderClientNameList() {
  qs('clientNameList').innerHTML = store.clients
    .map(client => `<option value="${escapeHtml(client.name)}"></option>`)
    .join('');
}

function renderClientSelect(selectId, blankLabel = 'Use manual entry / new client') {
  const select = qs(selectId);
  if (!select) return;
  const options = [`<option value="">${escapeHtml(blankLabel)}</option>`];
  store.clients.forEach(client => {
    options.push(`<option value="${client.id}">${escapeHtml(client.name)}${client.phone ? ` • ${escapeHtml(client.phone)}` : ''}</option>`);
  });
  select.innerHTML = options.join('');
}

function renderSelects() {
  ['leadClientSelect', 'estimateClientSelect', 'jobClientSelect', 'calendarClientSelect', 'noteClientSelect', 'invoiceClientSelect'].forEach(id => renderClientSelect(id));
  const related = qs('relatedEstimate');
  related.innerHTML = ['<option value="">None</option>']
    .concat(store.estimates.slice().reverse().map(estimate => `<option value="${estimate.id}">${escapeHtml(estimate.estimateNumber)} • ${escapeHtml(estimate.user)} • ${currency(estimate.estimatedCost)}</option>`))
    .join('');
}

function clientSummary(clientId) {
  const leadCount = store.leads.filter(item => item.clientId === clientId).length;
  const estimateCount = store.estimates.filter(item => item.clientId === clientId).length;
  const invoiceCount = store.invoices.filter(item => item.clientId === clientId).length;
  const jobCount = store.jobs.filter(item => item.clientId === clientId).length;
  return `${leadCount} lead(s) • ${estimateCount} estimate(s) • ${invoiceCount} invoice(s) • ${jobCount} job(s)`;
}

function renderClients() {
  const query = normalize(qs('clientSearch')?.value || '');
  const filtered = store.clients.filter(client => {
    if (!query) return true;
    return [client.name, client.phone, client.email, client.tags, client.serviceArea, client.source].some(value => normalize(value).includes(query));
  });

  qs('clientList').innerHTML = filtered.length
    ? filtered.slice().reverse().map(client => `
      <div class="item">
        <strong>${escapeHtml(client.name)}</strong>
        <div>${escapeHtml(client.phone || '')}${client.email ? ` • ${escapeHtml(client.email)}` : ''}</div>
        <div class="muted">${escapeHtml(client.serviceArea || '')}${client.source ? ` • ${escapeHtml(client.source)}` : ''}</div>
        <div class="muted">${escapeHtml(clientSummary(client.id))}</div>
        ${client.tags ? `<div class="muted">Tags: ${escapeHtml(client.tags)}</div>` : ''}
        <div class="item-actions">
          <button class="ghost-btn" onclick="window.selectClient('${client.id}')">Open</button>
          <button class="ghost-btn" onclick="window.editClient('${client.id}')">Edit</button>
          <button class="ghost-btn" onclick="window.useClientInLead('${client.id}')">Lead</button>
          <button class="ghost-btn" onclick="window.useClientInEstimate('${client.id}')">Estimate</button>
          <button class="danger-btn" onclick="window.softDelete('clients','${client.id}')">Trash</button>
        </div>
      </div>
    `).join('')
    : '<div class="item">No clients found.<div class="item-actions"><button type="button" class="ghost-btn" data-open-tab="clients">Create Client</button></div></div>';

  renderClientDetail(selectedClientId && findClientById(selectedClientId) ? selectedClientId : (filtered[0]?.id || null));
}

function renderClientDetail(clientId) {
  if (!clientId) {
    qs('clientDetailTitle').textContent = 'Select a client';
    qs('clientDetailBody').innerHTML = 'Choose a client to see linked leads, estimates, projects, invoices, and notes.';
    return;
  }
  selectedClientId = clientId;
  const client = findClientById(clientId);
  if (!client) return;
  const leads = store.leads.filter(item => item.clientId === clientId);
  const estimates = store.estimates.filter(item => item.clientId === clientId);
  const jobs = store.jobs.filter(item => item.clientId === clientId);
  const invoices = store.invoices.filter(item => item.clientId === clientId);
  const notes = store.notes.filter(item => item.clientId === clientId);

  qs('clientDetailTitle').textContent = client.name;
  qs('clientDetailBody').innerHTML = `
    <div class="detail-block">
      <div class="detail-metrics">
        <div class="metric"><span>Phone</span><strong>${escapeHtml(client.phone || '—')}</strong></div>
        <div class="metric"><span>Email</span><strong>${escapeHtml(client.email || '—')}</strong></div>
        <div class="metric"><span>Area</span><strong>${escapeHtml(client.serviceArea || '—')}</strong></div>
        <div class="metric"><span>Source</span><strong>${escapeHtml(client.source || '—')}</strong></div>
      </div>
      ${client.notes ? `<div class="muted" style="margin-top:10px;">${escapeHtml(client.notes)}</div>` : ''}
    </div>
    <div class="detail-block">
      <h4>Connected Records</h4>
      <div class="detail-metrics">
        <div class="metric"><span>Leads</span><strong>${leads.length}</strong></div>
        <div class="metric"><span>Estimates</span><strong>${estimates.length}</strong></div>
        <div class="metric"><span>Projects</span><strong>${jobs.length}</strong></div>
        <div class="metric"><span>Invoices</span><strong>${invoices.length}</strong></div>
      </div>
    </div>
    <div class="detail-block">
      <h4>Recent Client Activity</h4>
      <div class="stack">
        ${[
          ...leads.slice(-2).map(item => `<div class="feed-item"><strong>Lead</strong><div>${escapeHtml(item.service)} • ${escapeHtml(item.status)}</div></div>`),
          ...estimates.slice(-2).map(item => `<div class="feed-item"><strong>Estimate ${escapeHtml(item.estimateNumber)}</strong><div>${currency(item.estimatedCost)} • ${escapeHtml(item.status)}</div></div>`),
          ...jobs.slice(-2).map(item => `<div class="feed-item"><strong>Project</strong><div>${escapeHtml(item.service)} • ${escapeHtml(item.status)}</div></div>`),
          ...invoices.slice(-2).map(item => `<div class="feed-item"><strong>Invoice ${escapeHtml(item.invoiceNumber)}</strong><div>${currency(item.total)} • ${escapeHtml(item.status)}</div></div>`),
          ...notes.slice(-2).map(item => `<div class="feed-item"><strong>Note</strong><div>${escapeHtml(item.category)}</div></div>`)
        ].slice(-6).join('') || '<div class="feed-item">No linked records yet.</div>'}
      </div>
    </div>
  `;
}

function renderLeads() {
  const rows = store.leads.map(lead => `
    <tr>
      <td>${escapeHtml(lead.clientName)}</td>
      <td>${escapeHtml(lead.service)}</td>
      <td>${escapeHtml(lead.area || '')}</td>
      <td><span class="status ${statusClass(lead.status)}">${escapeHtml(lead.status)}</span></td>
      <td>${escapeHtml(lead.phone || '')}</td>
      <td>${escapeHtml(lead.preferredDate || '')}</td>
      <td>
        <div>${escapeHtml(lead.notes || '')}</div>
        <div class="inline-actions">
          <button class="ghost-btn" onclick="window.useLeadInEstimate('${lead.id}')">Estimate</button>
          <button class="danger-btn" onclick="window.softDelete('leads','${lead.id}')">Trash</button>
        </div>
      </td>
    </tr>
  `).join('');

  qs('leadTable').innerHTML = `
    <div class="table-shell">
      <table>
        <thead>
          <tr><th>Client</th><th>Service</th><th>Area</th><th>Status</th><th>Phone</th><th>Date</th><th>Notes / Actions</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7">No leads yet. <button type="button" class="ghost-btn" data-open-tab="leads">Add Lead</button></td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function estimateSummaryHtml(calc) {
  if (!calc) return '';
  return `
    <div class="summary-box"><span>Labor base</span><strong>${currency(calc.laborBase)}</strong></div>
    <div class="summary-box"><span>Material markup</span><strong>${currency(calc.materialMarkup)}</strong></div>
    <div class="summary-box"><span>Labor markup</span><strong>${currency(calc.laborMarkup)}</strong></div>
    <div class="summary-box"><span>Final pay</span><strong>${currency(calc.finalPay)}</strong></div>
    <div class="summary-box"><span>Deposit amount</span><strong>${currency(calc.depositAmount)}</strong></div>
    <div class="summary-box total"><span>Total estimate</span><strong>${currency(calc.estimatedCost)}</strong></div>
  `;
}

function renderEstimateSummary(calc) {
  qs('estimateSummary').innerHTML = estimateSummaryHtml(calc);
}

function renderEstimates() {
  qs('estimateList').innerHTML = store.estimates.length
    ? store.estimates.slice().reverse().map(item => `
      <div class="item">
        <strong>${escapeHtml(item.estimateNumber)} • ${escapeHtml(item.user)}</strong>
        <div>${escapeHtml(item.trade)} • ${escapeHtml(item.measurementType)} • ${currency(item.estimatedCost)}</div>
        <div class="muted"><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span> • Deposit ${currency(item.depositAmount || 0)}</div>
        ${item.scope ? `<div class="muted">${escapeHtml(item.scope)}</div>` : ''}
        <div class="item-actions">
          <button class="ghost-btn" onclick="window.loadEstimateIntoForm('${item.id}')">Edit / Reuse</button>
          <button class="ghost-btn" onclick="window.createInvoiceFromEstimate('${item.id}')">Create Invoice</button>
          <button class="ghost-btn" onclick="window.printEstimateById('${item.id}')">Print</button>
          <button class="ghost-btn" onclick="window.emailEstimateById('${item.id}')">Email Draft</button>
          <button class="danger-btn" onclick="window.softDelete('estimates','${item.id}')">Trash</button>
        </div>
      </div>
    `).join('')
    : '<div class="item">No estimates yet.<div class="item-actions"><button type="button" class="ghost-btn" data-open-tab="estimates">Build Estimate</button></div></div>';
}

function renderJobs() {
  const columns = ['Estimate', 'Scheduled', 'In Progress', 'On Hold', 'Completed'];
  qs('jobBoard').innerHTML = columns.map(column => {
    const cards = store.jobs.filter(item => item.status === column).map(job => `
      <div class="job-card">
        <strong>${escapeHtml(job.client)}</strong>
        <div>${escapeHtml(job.service)}</div>
        <div class="muted">${currency(job.value)}${job.startDate ? ` • ${escapeHtml(job.startDate)}` : ''}</div>
        <div class="muted">${escapeHtml(job.notes || '')}</div>
        <div class="inline-actions"><button class="danger-btn" onclick="window.softDelete('jobs','${job.id}')">Trash</button></div>
      </div>
    `).join('') || '<div class="job-card">No projects in this stage.</div>';
    return `<div class="kanban-col"><h4>${escapeHtml(column)}</h4>${cards}</div>`;
  }).join('');
}

function renderCalendar() {
  const items = store.calendar.slice().sort((a, b) => a.date.localeCompare(b.date));
  qs('calendarList').innerHTML = items.length
    ? items.map(item => `
      <div class="item">
        <strong>${escapeHtml(item.title)}</strong>
        <div>${escapeHtml(item.date)} • ${escapeHtml(item.type)}</div>
        <div class="muted">${escapeHtml(item.client || '')}</div>
        <div class="muted">${escapeHtml(item.notes || '')}</div>
        <div class="item-actions"><button class="danger-btn" onclick="window.softDelete('calendar','${item.id}')">Trash</button></div>
      </div>
    `).join('')
    : '<div class="item">No calendar items yet.<div class="item-actions"><button type="button" class="ghost-btn" data-open-tab="calendar">Add Event</button></div></div>';
}

function renderNotes() {
  qs('noteList').innerHTML = store.notes.length
    ? store.notes.slice().reverse().map(note => `
      <div class="note-item">
        <strong>${escapeHtml(note.title)}</strong>
        <div>${escapeHtml(note.category)}</div>
        <div class="muted">${escapeHtml(note.body || '')}</div>
        ${noteLinkMarkup(note.link)}
        <div class="item-actions"><button class="danger-btn" onclick="window.softDelete('notes','${note.id}')">Trash</button></div>
      </div>
    `).join('')
    : '<div class="note-item">No notes yet.<div class="item-actions"><button type="button" class="ghost-btn" data-open-tab="documents">Add Note</button></div></div>';
}

function renderEmployees() {
  if (!el.employeeList) return;
  const query = normalize(el.employeeSearch?.value || '');
  const users = (state.teamProfiles || []).filter(profile => {
    if (!query) return true;
    return [profile.full_name, profile.email, profile.role, profile.phone].some(value => normalize(value).includes(query));
  });

  el.employeeList.innerHTML = users.length
    ? users.map(profile => {
      const fullName = profile.full_name || profile.email;
      const email = profile.email || '';
      const phone = profile.phone || getStoredPhone(profile.id) || '';
      return `
        <div class="user-card">
          <div>
            <strong>${escapeHtml(fullName)}</strong>
            <div class="user-meta">
              <div>Role: ${escapeHtml(getRoleLabel(profile.role || 'staff'))}</div>
              <div>Status: ${escapeHtml(profile.status || 'active')}</div>
            </div>
          </div>
          <div class="form-actions">
            <a class="ghost-btn" href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a>
            ${phone ? `<a class="ghost-btn" href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ''))}">${escapeHtml(phone)}</a>` : '<span class="muted tiny">No phone added</span>'}
          </div>
        </div>
      `;
    }).join('')
    : '<div class="feed-item">No matching employees found.</div>';
}

function invoiceSummaryHtml(total) {
  return `
    <div class="summary-box total"><span>Balance due</span><strong>${currency(total)}</strong></div>
  `;
}

function renderInvoices() {
  qs('invoiceList').innerHTML = store.invoices.length
    ? store.invoices.slice().reverse().map(invoice => `
      <div class="item">
        <strong>${escapeHtml(invoice.invoiceNumber)} • ${escapeHtml(invoice.clientName)}</strong>
        <div>${escapeHtml(invoice.date)} • ${currency(invoice.total)}</div>
        <div class="muted"><span class="status ${statusClass(invoice.status)}">${escapeHtml(invoice.status)}</span></div>
        <div class="item-actions">
          <button class="ghost-btn" onclick="window.printInvoiceById('${invoice.id}')">Print</button>
          <button class="ghost-btn" onclick="window.emailInvoiceById('${invoice.id}')">Email Draft</button>
          <button class="danger-btn" onclick="window.softDelete('invoices','${invoice.id}')">Trash</button>
        </div>
      </div>
    `).join('')
    : '<div class="item">No invoices yet.<div class="item-actions"><button type="button" class="ghost-btn" data-open-tab="invoices">Create Invoice</button></div></div>';
}

function renderTrash() {
  qs('trashList').innerHTML = store.trash.length
    ? store.trash.slice().reverse().map(item => `
      <div class="trash-item">
        <strong>${escapeHtml(item.label)}</strong>
        <div>${escapeHtml(item.type)} • Deleted ${escapeHtml(item.deletedAt)}</div>
        <div class="muted">Reason: ${escapeHtml(item.reason || 'Manual trash action')}</div>
        <div class="item-actions">
          <button class="ghost-btn" onclick="window.restoreTrashItem('${item.trashId}')">Restore</button>
          <button class="danger-btn" onclick="window.permanentlyDeleteTrashItem('${item.trashId}')">Permanent Delete</button>
        </div>
      </div>
    `).join('')
    : '<div class="trash-item">Trash is empty.</div>';
}

function renderAll() {
  renderClientNameList();
  renderSelects();
  renderDashboard();
  renderClients();
  renderLeads();
  renderEstimates();
  renderJobs();
  renderCalendar();
  renderNotes();
  renderInvoices();
  renderTrash();
  renderEmployees();
  renderPendingUsers();
  renderAdminUsers();
  bindDynamicTabLinks();
}

function loadPhoneMap() {
  try {
    return JSON.parse(localStorage.getItem(PHONE_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePhoneMap(map) {
  localStorage.setItem(PHONE_MAP_KEY, JSON.stringify(map));
}

function getStoredPhone(userId) {
  if (!userId) return '';
  const map = loadPhoneMap();
  return map[userId] || '';
}

function setStoredPhone(userId, phone) {
  if (!userId) return;
  const map = loadPhoneMap();
  if (!phone) {
    delete map[userId];
  } else {
    map[userId] = phone;
  }
  savePhoneMap(map);
}

function showDuplicateAlert(id, matches) {
  const node = qs(id);
  if (!node) return;
  if (!matches.length) {
    node.classList.add('hidden');
    node.innerHTML = '';
    return;
  }
  node.classList.remove('hidden');
  node.innerHTML = `Possible existing client match: ${matches.map(item => escapeHtml(item.name)).join(', ')}. Select the existing client to avoid duplicates.`;
}

function populateClientFields(form, client, mapping) {
  if (!client) return;
  Object.entries(mapping).forEach(([fieldName, clientField]) => {
    if (form[fieldName]) form[fieldName].value = client[clientField] || '';
  });
}

function addInvoiceRow(description = '', amount = '') {
  const template = qs('invoiceRowTemplate');
  const row = template.content.firstElementChild.cloneNode(true);
  row.querySelector('.desc').value = description;
  row.querySelector('.amount').value = amount;
  row.querySelector('.remove-invoice-row').addEventListener('click', () => {
    row.remove();
    updateInvoiceTotal();
  });
  row.querySelector('.amount').addEventListener('input', updateInvoiceTotal);
  qs('invoiceItems').appendChild(row);
}

function updateInvoiceTotal() {
  const total = Array.from(document.querySelectorAll('#invoiceItems .amount')).reduce((sum, input) => sum + Number(input.value || 0), 0);
  qs('invoiceSummary').innerHTML = invoiceSummaryHtml(total);
  return total;
}

function resetEstimateForm() {
  const form = qs('estimateForm');
  form.reset();
  form.estimateId.value = '';
  form.estimateNumber.value = generateCode('E', store.estimates.map(item => item.estimateNumber));
  form.date.value = todayISO();
  form.status.value = 'Draft';
  form.depositPercent.value = 30;
  form.laborPercent.value = 15;
  form.finalPercent.value = 8;
  qs('pricingMode').dispatchEvent(new Event('change'));
  renderEstimateSummary(null);
}

function resetInvoiceForm() {
  const form = qs('invoiceForm');
  form.reset();
  form.invoiceNumber.value = generateCode('V', store.invoices.map(item => item.invoiceNumber));
  form.date.value = todayISO();
  form.status.value = 'Draft';
  qs('invoiceItems').innerHTML = '';
  addInvoiceRow('Deposit', '0');
  updateInvoiceTotal();
}

function softDeleteEntity(type, id, reason = 'Manual trash action') {
  const collection = store[type];
  if (!Array.isArray(collection)) return;
  const index = collection.findIndex(item => item.id === id);
  if (index === -1) return;
  const [entity] = collection.splice(index, 1);
  const label = entity.name || entity.clientName || entity.user || entity.invoiceNumber || entity.estimateNumber || entity.title || entity.client || entity.service || id;
  store.trash.push({
    trashId: createId('TRASH'),
    type,
    deletedAt: todayISO(),
    reason,
    label,
    data: entity
  });
  addActivity(`${label} moved to Trash.`, 'Trash');
  saveStore();
  renderAll();
}

function restoreTrashRecord(trashId) {
  const index = store.trash.findIndex(item => item.trashId === trashId);
  if (index === -1) return;
  const [item] = store.trash.splice(index, 1);
  store[item.type].push(item.data);
  addActivity(`${item.label} restored from Trash.`, 'Trash');
  saveStore();
  renderAll();
}

function permanentlyDeleteTrashRecord(trashId) {
  const index = store.trash.findIndex(item => item.trashId === trashId);
  if (index === -1) return;
  const [item] = store.trash.splice(index, 1);
  addActivity(`${item.label} permanently deleted.`, 'Trash');
  saveStore();
  renderAll();
}

function estimatePrintHtml(record) {
  return `
  <html><head><title>${record.estimateNumber}</title><style>
  body{font-family:Arial,sans-serif;padding:32px;color:#1f1d19} h1,h2{margin:0 0 8px} .top{display:flex;justify-content:space-between;gap:20px;margin-bottom:24px} .box{border:1px solid #ddd;padding:16px;border-radius:12px;margin-bottom:14px} table{width:100%;border-collapse:collapse;margin-top:12px} td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left} .total{font-size:1.2rem;font-weight:bold}.muted{color:#666}
  </style></head><body>
  <div class="top"><div><h1>Harvest Renovation</h1><div>Juan Puentes</div><div>(832) 944-0267</div><div>jp@harvestrenovation.com</div><div>www.harvestrenovation.net</div></div><div><h2>Estimate</h2><div><strong>No:</strong> ${record.estimateNumber}</div><div><strong>Date:</strong> ${record.date}</div></div></div>
  <div class="box"><strong>To:</strong> ${escapeHtml(record.user)}<br><span class="muted">Trade:</span> ${escapeHtml(record.trade)}<br><span class="muted">Measurement:</span> ${escapeHtml(record.measurementType)}</div>
  <div class="box"><strong>Scope</strong><br>${escapeHtml(record.scope || 'Project scope to be confirmed.')}</div>
  <table>
  <tr><th>Item</th><th>Value</th></tr>
  <tr><td>Rate</td><td>${currency(record.rate)}</td></tr>
  <tr><td>Quantity</td><td>${record.quantity}</td></tr>
  <tr><td>Labor Base</td><td>${currency(record.laborBase)}</td></tr>
  <tr><td>Material Cost</td><td>${currency(record.materialCost)}</td></tr>
  <tr><td>Material Markup (${record.materialPercent}%)</td><td>${currency(record.materialMarkup)}</td></tr>
  ${record.useLaborPercent ? `<tr><td>Labor Markup (${record.laborPercent}%)</td><td>${currency(record.laborMarkup)}</td></tr>` : `<tr><td>Final Pay (${record.finalPercent}%)</td><td>${currency(record.finalPay)}</td></tr>`}
  <tr><td>Deposit</td><td>${currency(record.depositAmount || 0)}</td></tr>
  <tr><td class="total">Estimated Total</td><td class="total">${currency(record.estimatedCost)}</td></tr>
  </table>
  <p style="margin-top:22px">A ${record.depositPercent || 30}% upfront deposit is required to cover material costs.</p>
  </body></html>`;
}

function invoicePrintHtml(record) {
  const rows = record.items.map(item => `<tr><td>${escapeHtml(item.description)}</td><td>${currency(item.amount)}</td></tr>`).join('');
  return `
  <html><head><title>${record.invoiceNumber}</title><style>
  body{font-family:Arial,sans-serif;padding:32px;color:#1f1d19} h1,h2{margin:0 0 8px} .top{display:flex;justify-content:space-between;gap:20px;margin-bottom:24px} .box{border:1px solid #ddd;padding:16px;border-radius:12px;margin-bottom:14px} table{width:100%;border-collapse:collapse;margin-top:12px} td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left} .total{font-size:1.2rem;font-weight:bold}
  </style></head><body>
  <div class="top"><div><h1>Harvest Renovation</h1><div>Juan Puentes</div><div>(832) 944-0267</div><div>jp@harvestrenovation.com</div><div>www.harvestrenovation.net</div></div><div><h2>Invoice</h2><div><strong>No:</strong> ${record.invoiceNumber}</div><div><strong>Date:</strong> ${record.date}</div></div></div>
  <div class="box"><strong>To:</strong> ${escapeHtml(record.clientName)}<br>${escapeHtml(record.address || '')}<br>${escapeHtml(record.phone || '')}<br>${escapeHtml(record.email || '')}</div>
  <table><tr><th>Description</th><th>Amount</th></tr>${rows}<tr><td class="total">Balance Due</td><td class="total">${currency(record.total)}</td></tr></table>
  <p style="margin-top:22px">For questions concerning this invoice, please contact Juan Puentes at (832) 944-0267.</p>
  </body></html>`;
}

function openPrintWindow(html) {
  const win = window.open('', '_blank', 'width=980,height=900');
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function buildMailto(recipient, subject, body) {
  return `mailto:${recipient || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function bindCrmAutofill() {
  qs('leadClientSelect').addEventListener('change', event => {
    const client = findClientById(event.target.value);
    populateClientFields(qs('leadForm'), client, { clientName: 'name', phone: 'phone', email: 'email', area: 'serviceArea' });
  });
  qs('estimateClientSelect').addEventListener('change', event => {
    const client = findClientById(event.target.value);
    populateClientFields(qs('estimateForm'), client, { user: 'name' });
  });
  qs('jobClientSelect').addEventListener('change', event => {
    const client = findClientById(event.target.value);
    populateClientFields(qs('jobForm'), client, { client: 'name' });
  });
  qs('calendarClientSelect').addEventListener('change', event => {
    const client = findClientById(event.target.value);
    populateClientFields(qs('calendarForm'), client, { client: 'name' });
  });
  qs('noteClientSelect').addEventListener('change', event => {
    const client = findClientById(event.target.value);
    populateClientFields(qs('noteForm'), client, { title: 'name' });
  });
  qs('invoiceClientSelect').addEventListener('change', event => {
    const client = findClientById(event.target.value);
    populateClientFields(qs('invoiceForm'), client, { clientName: 'name', phone: 'phone', email: 'email', address: 'address' });
  });
  qs('relatedEstimate').addEventListener('change', event => {
    const estimate = findEstimateById(event.target.value);
    if (!estimate) return;
    const form = qs('invoiceForm');
    const client = estimate.clientId ? findClientById(estimate.clientId) : null;
    form.clientId.value = estimate.clientId || '';
    form.clientName.value = estimate.user;
    form.phone.value = client?.phone || '';
    form.email.value = client?.email || '';
    form.address.value = client?.address || '';
    qs('invoiceItems').innerHTML = '';
    addInvoiceRow(`${estimate.trade} — ${estimate.scope || 'Project work'}`, estimate.estimatedCost.toFixed(2));
    updateInvoiceTotal();
  });
}

function bindCrmForms() {
  qs('clientForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    let savedClientId = data.clientId;
    if (data.clientId) {
      const client = findClientById(data.clientId);
      Object.assign(client, {
        name: data.name,
        phone: data.phone,
        email: data.email,
        serviceArea: data.serviceArea,
        address: data.address,
        source: data.source,
        tags: data.tags,
        notes: data.notes
      });
      addActivity(`Client ${data.name} updated.`, 'Clients');
    } else {
      savedClientId = ensureClientRecord({
        name: data.name,
        phone: data.phone,
        email: data.email,
        area: data.serviceArea,
        address: data.address,
        source: data.source,
        tags: data.tags,
        notes: data.notes
      }).id;
    }
    saveStore();
    form.reset();
    form.clientId.value = '';
    clearFormDirty(form);
    showDuplicateAlert('clientDuplicateAlert', []);
    selectedClientId = savedClientId;
    renderAll();
    renderClientDetail(selectedClientId);
    showToast('Client saved.', 'success');
  });

  qs('leadForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const client = data.clientId ? findClientById(data.clientId) : ensureClientRecord({
      name: data.clientName,
      phone: data.phone,
      email: data.email,
      area: data.area,
      notes: data.notes
    });
    store.leads.push({
      id: createId('L'),
      clientId: client?.id || '',
      clientName: data.clientName,
      phone: data.phone,
      email: data.email,
      service: data.service,
      area: data.area,
      status: data.status,
      preferredDate: data.preferredDate,
      notes: data.notes
    });
    addActivity(`Lead saved for ${data.clientName}.`, 'Leads');
    saveStore();
    form.reset();
    clearFormDirty(form);
    showDuplicateAlert('leadDuplicateAlert', []);
    renderAll();
    showToast('Lead saved.', 'success');
  });

  qs('pricingMode').addEventListener('change', event => {
    const isLabor = event.target.value === 'labor';
    qs('laborPercentWrap').classList.toggle('hidden', !isLabor);
    qs('finalPercentWrap').classList.toggle('hidden', isLabor);
  });

  qs('calculateEstimate').addEventListener('click', () => {
    try {
      const data = Object.fromEntries(new FormData(qs('estimateForm')).entries());
      renderEstimateSummary(calculateEstimate(data));
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  qs('estimateForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const calc = calculateEstimate(data);
      const client = data.clientId ? findClientById(data.clientId) : ensureClientRecord({ name: data.user });
      const record = {
        id: data.estimateId || createId('EID'),
        clientId: client?.id || '',
        estimateNumber: data.estimateNumber,
        date: data.date,
        user: data.user,
        trade: data.trade,
        measurementType: data.measurementType,
        rate: Number(data.rate),
        quantity: Number(data.quantity),
        materialCost: Number(data.materialCost),
        materialPercent: Number(data.materialPercent),
        pricingMode: data.pricingMode,
        laborPercent: Number(data.laborPercent || 0),
        finalPercent: Number(data.finalPercent || 0),
        depositPercent: Number(data.depositPercent || 0),
        scope: data.scope,
        status: data.status,
        ...calc,
        value: calc.estimatedCost
      };
      if (data.estimateId) {
        const index = store.estimates.findIndex(item => item.id === data.estimateId);
        store.estimates[index] = record;
        addActivity(`Estimate ${record.estimateNumber} updated.`, 'Estimates');
      } else {
        store.estimates.push(record);
        addActivity(`Estimate ${record.estimateNumber} created for ${record.user}.`, 'Estimates');
      }
      saveStore();
      renderAll();
      showToast('Estimate saved.', 'success');
      resetEstimateForm();
      clearFormDirty(form);
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  qs('jobForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const client = data.clientId ? findClientById(data.clientId) : ensureClientRecord({ name: data.client });
    store.jobs.push({
      id: createId('J'),
      clientId: client?.id || '',
      client: data.client,
      service: data.service,
      status: data.status,
      value: Number(data.value || 0),
      startDate: data.startDate,
      notes: data.notes
    });
    addActivity(`Project saved for ${data.client}.`, 'Projects');
    saveStore();
    form.reset();
    clearFormDirty(form);
    renderAll();
    showToast('Project saved.', 'success');
  });

  qs('calendarForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    store.calendar.push({ id: createId('C'), ...data });
    addActivity(`Calendar item ${data.title} added.`, 'Calendar');
    saveStore();
    form.reset();
    clearFormDirty(form);
    renderAll();
    showToast('Calendar item saved.', 'success');
  });

  qs('noteForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    store.notes.push({ id: createId('N'), ...data });
    addActivity(`Note saved for ${data.title}.`, 'Notes');
    saveStore();
    form.reset();
    clearFormDirty(form);
    renderAll();
    showToast('Note saved.', 'success');
  });

  qs('invoiceForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const client = data.clientId ? findClientById(data.clientId) : ensureClientRecord({ name: data.clientName, phone: data.phone, email: data.email, address: data.address });
    const items = Array.from(document.querySelectorAll('#invoiceItems .invoice-row')).map(row => ({
      description: row.querySelector('.desc').value,
      amount: Number(row.querySelector('.amount').value || 0)
    })).filter(item => item.description || item.amount);
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    store.invoices.push({
      id: createId('INV'),
      clientId: client?.id || '',
      relatedEstimate: data.relatedEstimate,
      invoiceNumber: data.invoiceNumber,
      date: data.date,
      clientName: data.clientName,
      address: data.address,
      phone: data.phone,
      email: data.email,
      status: data.status,
      items,
      total
    });
    addActivity(`Invoice ${data.invoiceNumber} created for ${data.clientName}.`, 'Invoices');
    saveStore();
    renderAll();
    showToast('Invoice saved.', 'success');
    resetInvoiceForm();
    clearFormDirty(form);
  });
}

function bindCrmButtons() {
  qs('clearClientForm').addEventListener('click', () => {
    qs('clientForm').reset();
    qs('clientForm').clientId.value = '';
    clearFormDirty(qs('clientForm'));
    showDuplicateAlert('clientDuplicateAlert', []);
  });
  qs('clearLeadForm').addEventListener('click', () => {
    qs('leadForm').reset();
    clearFormDirty(qs('leadForm'));
    showDuplicateAlert('leadDuplicateAlert', []);
  });
  qs('clearEstimateForm').addEventListener('click', () => {
    resetEstimateForm();
    clearFormDirty(qs('estimateForm'));
  });
  qs('clearJobForm').addEventListener('click', () => {
    qs('jobForm').reset();
    clearFormDirty(qs('jobForm'));
  });
  qs('clearCalendarForm').addEventListener('click', () => {
    qs('calendarForm').reset();
    clearFormDirty(qs('calendarForm'));
  });
  qs('clearNoteForm').addEventListener('click', () => {
    qs('noteForm').reset();
    clearFormDirty(qs('noteForm'));
  });
  qs('clearInvoiceForm').addEventListener('click', () => {
    resetInvoiceForm();
    clearFormDirty(qs('invoiceForm'));
  });
  qs('addInvoiceRow').addEventListener('click', () => addInvoiceRow('', '0'));

  qs('printEstimate').addEventListener('click', () => {
    try {
      const data = Object.fromEntries(new FormData(qs('estimateForm')).entries());
      const calc = calculateEstimate(data);
      openPrintWindow(estimatePrintHtml({ ...data, ...calc, useLaborPercent: data.pricingMode === 'labor' }));
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  qs('emailEstimate').addEventListener('click', () => {
    try {
      const data = Object.fromEntries(new FormData(qs('estimateForm')).entries());
      const calc = calculateEstimate(data);
      const body = `Hi ${data.user},\n\nHere is your estimate from Harvest Renovation.\nEstimate ${data.estimateNumber}: ${currency(calc.estimatedCost)}\nDeposit: ${currency(calc.depositAmount)}\nTrade: ${data.trade}\nScope: ${data.scope || 'Project scope to be confirmed.'}\n\nThank you,\nJuan`;
      window.location.href = buildMailto('', `Harvest Renovation Estimate ${data.estimateNumber}`, body);
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  qs('printInvoice').addEventListener('click', () => {
    const formData = Object.fromEntries(new FormData(qs('invoiceForm')).entries());
    const items = Array.from(document.querySelectorAll('#invoiceItems .invoice-row')).map(row => ({
      description: row.querySelector('.desc').value,
      amount: Number(row.querySelector('.amount').value || 0)
    })).filter(item => item.description || item.amount);
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    openPrintWindow(invoicePrintHtml({ ...formData, items, total }));
  });

  qs('emailInvoice').addEventListener('click', () => {
    const formData = Object.fromEntries(new FormData(qs('invoiceForm')).entries());
    const total = updateInvoiceTotal();
    const body = `Hi ${formData.clientName},\n\nAttached is invoice ${formData.invoiceNumber} from Harvest Renovation for ${currency(total)}.\n\nThank you,\nJuan`;
    window.location.href = buildMailto(formData.email || '', `Harvest Renovation Invoice ${formData.invoiceNumber}`, body);
  });
}

function bindCrmDuplicateAlerts() {
  const clientForm = qs('clientForm');
  ['name', 'phone', 'email'].forEach(field => {
    clientForm[field].addEventListener('input', () => {
      const matches = duplicateClients({ name: clientForm.name.value, phone: clientForm.phone.value, email: clientForm.email.value })
        .filter(item => item.id !== clientForm.clientId.value);
      showDuplicateAlert('clientDuplicateAlert', matches);
    });
  });

  const leadForm = qs('leadForm');
  ['clientName', 'phone', 'email'].forEach(field => {
    leadForm[field].addEventListener('input', () => {
      const matches = duplicateClients({ name: leadForm.clientName.value, phone: leadForm.phone.value, email: leadForm.email.value });
      showDuplicateAlert('leadDuplicateAlert', matches);
    });
  });
}

function applyEstimateTemplate(key, fillTrade = true) {
  const template = estimateTemplates[key];
  if (!template) return;
  const form = qs('estimateForm');
  if (fillTrade) form.trade.value = template.trade;
  form.measurementType.value = template.measurementType;
  if (!form.rate.value) form.rate.value = template.rate;
  if (!form.materialPercent.value) form.materialPercent.value = template.materialPercent;
  if (!form.laborPercent.value || Number(form.laborPercent.value) < 10) form.laborPercent.value = template.laborPercent;
  if (!form.finalPercent.value || Number(form.finalPercent.value) < 1) form.finalPercent.value = template.finalPercent;
  if (!form.scope.value) form.scope.value = template.scope;
}

function bindCrmTemplateBehavior() {
  qs('estimateTemplateSelect').addEventListener('change', event => {
    applyEstimateTemplate(event.target.value);
  });
}

function bindCrmSearch() {
  qs('clientSearch').addEventListener('input', renderClients);
}

window.selectClient = function(clientId) {
  selectedClientId = clientId;
  renderClientDetail(clientId);
};

window.editClient = function(clientId) {
  const client = findClientById(clientId);
  if (!client) return;
  const form = qs('clientForm');
  form.clientId.value = client.id;
  form.name.value = client.name;
  form.phone.value = client.phone;
  form.email.value = client.email;
  form.serviceArea.value = client.serviceArea;
  form.address.value = client.address;
  form.source.value = client.source;
  form.tags.value = client.tags;
  form.notes.value = client.notes;
  openTab('clients');
};

window.useClientInLead = function(clientId) {
  const client = findClientById(clientId);
  if (!client) return;
  const form = qs('leadForm');
  form.clientId.value = client.id;
  form.clientName.value = client.name;
  form.phone.value = client.phone;
  form.email.value = client.email;
  form.area.value = client.serviceArea;
  openTab('leads');
};

window.useClientInEstimate = function(clientId) {
  const client = findClientById(clientId);
  if (!client) return;
  const form = qs('estimateForm');
  form.clientId.value = client.id;
  form.user.value = client.name;
  openTab('estimates');
};

window.useLeadInEstimate = function(leadId) {
  const lead = store.leads.find(item => item.id === leadId);
  if (!lead) return;
  const form = qs('estimateForm');
  form.clientId.value = lead.clientId || '';
  form.user.value = lead.clientName;
  form.trade.value = lead.service;
  form.scope.value = lead.notes || '';
  form.templateKey.value = lead.service;
  applyEstimateTemplate(lead.service, false);
  openTab('estimates');
};

window.loadEstimateIntoForm = function(estimateId) {
  const record = findEstimateById(estimateId);
  if (!record) return;
  const form = qs('estimateForm');
  form.estimateId.value = record.id;
  form.clientId.value = record.clientId || '';
  form.estimateNumber.value = record.estimateNumber;
  form.date.value = record.date;
  form.user.value = record.user;
  form.trade.value = record.trade;
  form.measurementType.value = record.measurementType;
  form.rate.value = record.rate;
  form.quantity.value = record.quantity;
  form.materialCost.value = record.materialCost;
  form.materialPercent.value = record.materialPercent;
  form.pricingMode.value = record.pricingMode;
  qs('pricingMode').dispatchEvent(new Event('change'));
  form.laborPercent.value = record.laborPercent;
  form.finalPercent.value = record.finalPercent;
  form.depositPercent.value = record.depositPercent || 30;
  form.scope.value = record.scope;
  form.status.value = record.status;
  renderEstimateSummary(record);
  openTab('estimates');
};

window.createInvoiceFromEstimate = function(estimateId) {
  const estimate = findEstimateById(estimateId);
  if (!estimate) return;
  const client = estimate.clientId ? findClientById(estimate.clientId) : null;
  resetInvoiceForm();
  const form = qs('invoiceForm');
  form.relatedEstimate.value = estimate.id;
  form.clientId.value = estimate.clientId || '';
  form.clientName.value = estimate.user;
  form.phone.value = client?.phone || '';
  form.email.value = client?.email || '';
  form.address.value = client?.address || '';
  qs('invoiceItems').innerHTML = '';
  addInvoiceRow(`${estimate.trade} — ${estimate.scope || 'Project work'}`, estimate.estimatedCost.toFixed(2));
  updateInvoiceTotal();
  openTab('invoices');
};

window.softDelete = function(type, id) {
  softDeleteEntity(type, id);
};

window.restoreTrashItem = function(trashId) {
  restoreTrashRecord(trashId);
};

window.permanentlyDeleteTrashItem = function(trashId) {
  permanentlyDeleteTrashRecord(trashId);
};

window.printEstimateById = function(estimateId) {
  const record = findEstimateById(estimateId);
  if (record) openPrintWindow(estimatePrintHtml(record));
};

window.emailEstimateById = function(estimateId) {
  const record = findEstimateById(estimateId);
  if (!record) return;
  const body = `Hi ${record.user},\n\nHere is your estimate from Harvest Renovation.\nEstimate ${record.estimateNumber}: ${currency(record.estimatedCost)}\nDeposit: ${currency(record.depositAmount || 0)}\nTrade: ${record.trade}\nScope: ${record.scope || 'Project scope to be confirmed.'}\n\nThank you,\nJuan`;
  window.location.href = buildMailto('', `Harvest Renovation Estimate ${record.estimateNumber}`, body);
};

window.printInvoiceById = function(invoiceId) {
  const invoice = store.invoices.find(item => item.id === invoiceId);
  if (invoice) openPrintWindow(invoicePrintHtml(invoice));
};

window.emailInvoiceById = function(invoiceId) {
  const invoice = store.invoices.find(item => item.id === invoiceId);
  if (!invoice) return;
  const body = `Hi ${invoice.clientName},\n\nAttached is invoice ${invoice.invoiceNumber} from Harvest Renovation for ${currency(invoice.total)}.\n\nThank you,\nJuan`;
  window.location.href = buildMailto(invoice.email || '', `Harvest Renovation Invoice ${invoice.invoiceNumber}`, body);
};

function initCrmFeatures() {
  if (state.crmBindingsReady) return;
  state.crmBindingsReady = true;

  bindCrmSearch();
  bindCrmTemplateBehavior();
  bindCrmDuplicateAlerts();
  bindCrmAutofill();
  bindCrmForms();
  bindCrmButtons();
  resetEstimateForm();
  resetInvoiceForm();
  renderAll();
  if (store.clients[0]) selectedClientId = store.clients[0].id;
  renderClientDetail(selectedClientId);
}

bootstrap();
