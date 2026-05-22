import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { portalConfig } from './config.js';

const config = portalConfig || {};
const state = {
  supabase: null,
  session: null,
  profile: null,
  teamProfiles: [],
  portalSettings: {
    company_calendar_name: config.companyCalendarName || 'Harvest Renovation Company Calendar',
    company_calendar_embed_url: config.companyCalendarEmbedUrl || ''
  }
};

const el = {};

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
  qsa('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  qsa('.panel').forEach(panel => panel.classList.toggle('active', panel.id === tabId));
  const titles = {
    dashboard: ['Dashboard', 'Secure access, calendar visibility, and approval-based onboarding.'],
    'company-calendar': ['Company Calendar', 'Shared Google Calendar embedded for approved staff.'],
    'team-calendars': ['Team Calendars', 'See employee schedules and availability in one place.'],
    settings: ['Settings', 'Manage your profile, calendar visibility, and password.'],
    admin: ['Admin Approval', 'Approve or deny new user access requests.']
  };
  el.pageTitle.textContent = titles[tabId]?.[0] || 'Dashboard';
  el.pageSubtitle.textContent = titles[tabId]?.[1] || '';
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

  const missingConfig = !config.supabaseUrl || !config.supabasePublishableKey;
  if (missingConfig) {
    setSetupBanner('Setup required: add your Supabase URL and publishable key in config.js before using this portal.');
    showAuthMessage('This bundle is production-ready, but it still needs your live Supabase project credentials in config.js.', 'info');
    showShell('auth');
    return;
  }

  state.supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

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
    statsGrid: qs('statsGrid'),
    readinessList: qs('readinessList'),
    calendarGuide: qs('calendarGuide'),
    companyCalendarWrap: qs('companyCalendarWrap'),
    companyCalendarBadge: qs('companyCalendarBadge'),
    teamCalendarList: qs('teamCalendarList'),
    profileForm: qs('profileForm'),
    passwordForm: qs('passwordForm'),
    companyCalendarForm: qs('companyCalendarForm'),
    adminSettings: qs('adminSettings'),
    pendingList: qs('pendingList'),
    pendingBadge: qs('pendingBadge'),
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
  qsa('[data-open-tab]').forEach(btn => btn.addEventListener('click', () => openTab(btn.dataset.openTab)));
  qs('openPasswordPanelBtn').addEventListener('click', () => openTab('settings'));
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
  el.passwordForm.addEventListener('submit', handlePasswordChange);
  el.companyCalendarForm.addEventListener('submit', handleCompanyCalendarSave);
}

async function handleLogin(event) {
  event.preventDefault();
  clearAuthMessage();
  const fd = new FormData(el.loginForm);
  updateSaveStateChip('Signing in…');
  const { error } = await state.supabase.auth.signInWithPassword({
    email: fd.get('email'),
    password: fd.get('password')
  });
  if (error) {
    updateSaveStateChip('Auth error');
    showAuthMessage(error.message, 'error');
    return;
  }
  updateSaveStateChip('Authenticated');
}

async function handleSignup(event) {
  event.preventDefault();
  clearAuthMessage();
  const fd = new FormData(el.signupForm);
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
    email: fd.get('email'),
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
  const isBootstrapEmail = autoApprovedEmails.includes(String(fd.get('email')).toLowerCase());
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

    await Promise.all([
      loadTeamProfiles(),
      loadPortalSettings(forceRefresh),
      isAdmin() ? loadPendingUsers() : Promise.resolve([])
    ]);

    hydrateShell();
    renderDashboard();
    renderCompanyCalendar();
    renderTeamCalendars();
    renderPendingUsers();
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
    .select('id,email,full_name,role,status,google_calendar_embed_url,calendar_label,created_at')
    .eq('status', 'active')
    .order('full_name', { ascending: true });
  if (error) throw error;
  state.teamProfiles = data || [];
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
  el.profileForm.google_calendar_embed_url.value = state.profile.google_calendar_embed_url || '';
  el.profileForm.calendar_label.value = state.profile.calendar_label || '';

  el.companyCalendarForm.company_calendar_name.value = state.portalSettings.company_calendar_name || '';
  el.companyCalendarForm.company_calendar_embed_url.value = state.portalSettings.company_calendar_embed_url || '';

  qsa('.admin-only').forEach(node => node.classList.toggle('hidden', !isAdmin()));
  el.adminSettings.classList.toggle('hidden', !isAdmin());
}

function renderDashboard() {
  const activeUsers = state.teamProfiles.length;
  const teamCalendars = state.teamProfiles.filter(item => item.google_calendar_embed_url).length;
  const stats = [
    ['Approved Employees', activeUsers, 'Visible inside the portal'],
    ['Team Calendars Added', teamCalendars, 'Employees sharing Google calendars'],
    ['Company Calendar', state.portalSettings.company_calendar_embed_url ? 'Live' : 'Pending', 'Shared embed configuration'],
    ['Admin Approval', isAdmin() ? `${(state.pendingUsers || []).length} pending` : 'Staff view', 'Approval dashboard access'],
    ['Password Security', 'Enabled', 'Users can update their own password', true]
  ];
  el.statsGrid.innerHTML = stats.map(([label, value, note, warm]) => `
    <article class="stat ${warm ? 'warm' : ''}">
      <span class="label">${escapeHtml(label)}</span>
      <strong class="value">${escapeHtml(String(value))}</strong>
      <div class="muted">${escapeHtml(note)}</div>
    </article>
  `).join('');

  const readinessItems = [
    state.portalSettings.company_calendar_embed_url ? '✅ Shared company calendar is configured.' : '⚠️ Add the shared company calendar embed URL.',
    state.profile.google_calendar_embed_url ? '✅ Your personal calendar is visible to approved employees.' : '⚠️ Add your own calendar embed URL in Settings to share availability.',
    isAdmin() ? `${(state.pendingUsers || []).length} pending user request(s) ready for admin review.` : 'Staff users can view approved calendars once they are added.',
    '✅ Password change is available in Settings.',
    '✅ The app uses approval-gated login instead of browser-only local storage.'
  ];
  el.readinessList.innerHTML = readinessItems.map(item => `<div class="feed-item">${escapeHtml(item)}</div>`).join('');

  const guideItems = [
    'Open Google Calendar on desktop and choose the calendar you want to share.',
    'Use calendar sharing or embed settings to generate the correct calendar link for your work calendar.',
    'Paste that embed URL into your profile settings inside this portal.',
    'Other approved employees will then be able to view your calendar here.',
    'For cleaner operations, use dedicated work calendars instead of private personal calendars.'
  ];
  el.calendarGuide.innerHTML = guideItems.map(item => `<div class="feed-item">${escapeHtml(item)}</div>`).join('');
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
    updateSaveStateChip('Access updated');
  } catch (error) {
    console.error(error);
    updateSaveStateChip('Admin action failed');
    alert(error.message || 'Unable to update user access.');
  }
}

async function handleProfileSave(event) {
  event.preventDefault();
  try {
    updateSaveStateChip('Saving profile…');
    const fd = new FormData(el.profileForm);
    const payload = {
      p_full_name: fd.get('full_name'),
      p_google_calendar_embed_url: fd.get('google_calendar_embed_url') || null,
      p_calendar_label: fd.get('calendar_label') || null
    };
    await safeRpc('update_my_profile', payload);
    state.profile = await fetchMyProfile();
    await loadTeamProfiles();
    hydrateShell();
    renderDashboard();
    renderTeamCalendars();
    updateSaveStateChip('Profile saved');
    alert('Profile updated.');
  } catch (error) {
    console.error(error);
    updateSaveStateChip('Profile save failed');
    alert(error.message || 'Unable to save your profile.');
  }
}

async function handlePasswordChange(event) {
  event.preventDefault();
  const fd = new FormData(el.passwordForm);
  const password = fd.get('password');
  const confirmPassword = fd.get('confirm_password');
  if (password !== confirmPassword) {
    alert('Passwords do not match.');
    return;
  }
  if (String(password).length < 10) {
    alert('Use at least 10 characters for the new password.');
    return;
  }
  try {
    updateSaveStateChip('Updating password…');
    const { error } = await state.supabase.auth.updateUser({ password });
    if (error) throw error;
    el.passwordForm.reset();
    updateSaveStateChip('Password updated');
    alert('Password updated successfully.');
  } catch (error) {
    console.error(error);
    updateSaveStateChip('Password update failed');
    alert(error.message || 'Unable to update password.');
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
    updateSaveStateChip('Company calendar saved');
    alert('Company calendar settings updated.');
  } catch (error) {
    console.error(error);
    updateSaveStateChip('Calendar save failed');
    alert(error.message || 'Unable to save company calendar settings.');
  }
}

bootstrap();
