/**
 * Offline-first sync: localStorage is the UI source of truth.
 * When signed in, we push/pull with LWW per document and subscribe to Realtime.
 */
import { getSupabase, getSession, onAuthChange } from './client.js';
import { applySubscriptionRow } from '../plan.js';
import { isSupabaseConfigured, SUPABASE_URL } from '../config.js';
import { mergeDayMaps, mergeDoc, mergeMonthNotes, newer, snapshotForSync } from './merge.js';

export const SyncStatus = { Off: 'off', SignedOut: 'signed_out', Offline: 'offline', Syncing: 'syncing', Synced: 'synced', Error: 'error' };

export class SyncEngine {
  constructor(store, { onStatus } = {}) {
    this.store = store;
    this.onStatus = onStatus || (() => {});
    this.status = isSupabaseConfigured() ? SyncStatus.SignedOut : SyncStatus.Off;
    this.user = null;
    this._channel = null;
    this._pushTimer = null;
    this._pulling = false;
    this._applyingRemote = false;
    this._unsubAuth = null;
    this._unsubStore = null;
    this.calendarToken = null;
    this.lastError = null;
  }

  setStatus(s, err = null) {
    this.status = s;
    this.lastError = err;
    this.onStatus(s, err);
  }

  async start() {
    if (!isSupabaseConfigured()) { this.setStatus(SyncStatus.Off); return; }
    this._unsubStore = this.store.subscribe((reason) => {
      if (this._applyingRemote) return;
      if (['day', 'settings', 'style', 'templates', 'monthNotes', 'restore', 'change'].includes(reason) || reason === 'day') {
        this.schedulePush();
      }
    });
    window.addEventListener('online', () => this.fullSync());
    window.addEventListener('offline', () => { if (this.user) this.setStatus(SyncStatus.Offline); });
    this._unsubAuth = onAuthChange(async (event, session) => {
      this.user = session?.user || null;
      if (session) {
        await this.fullSync();
        this.subscribeRealtime();
        await this.ensureCalendarToken();
      } else {
        this.unsubscribeRealtime();
        this.calendarToken = null;
        this.setStatus(SyncStatus.SignedOut);
      }
    });
    const session = await getSession();
    this.user = session?.user || null;
    if (session) {
      await this.fullSync();
      this.subscribeRealtime();
      await this.ensureCalendarToken();
    } else {
      this.setStatus(SyncStatus.SignedOut);
    }
  }

  schedulePush() {
    if (!this.user) return;
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => this.pushLocal().catch((e) => this.setStatus(SyncStatus.Error, e)), 400);
  }

  async fullSync() {
    if (!this.user) return;
    if (!navigator.onLine) { this.setStatus(SyncStatus.Offline); return; }
    this.setStatus(SyncStatus.Syncing);
    try {
      await this.pullRemote();
      await this.pushLocal();
      this.setStatus(SyncStatus.Synced);
    } catch (e) {
      console.warn('sync failed', e);
      this.setStatus(SyncStatus.Error, e);
    }
  }

  async pullRemote() {
    const sb = getSupabase();
    if (!sb || !this.user) return;
    this._pulling = true;
    try {
      const uid = this.user.id;
      const [daysRes, settingsRes, templatesRes, notesRes, subRes] = await Promise.all([
        sb.from('days').select('day_date, doc, updated_at').eq('user_id', uid),
        sb.from('user_settings').select('doc, updated_at').eq('user_id', uid).maybeSingle(),
        sb.from('templates').select('doc, updated_at').eq('user_id', uid).maybeSingle(),
        sb.from('month_notes').select('month_key, doc, updated_at').eq('user_id', uid),
        sb.from('subscriptions').select('*').eq('user_id', uid).maybeSingle(),
      ]);
      if (daysRes.error) throw daysRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (notesRes.error) throw notesRes.error;
      // subscriptions select may 404 if migration lag — ignore soft errors
      if (subRes.error && subRes.error.code !== 'PGRST116') {
        console.warn('subscriptions pull', subRes.error.message);
      }

      const remoteDays = {};
      for (const row of daysRes.data || []) {
        remoteDays[row.day_date] = { ...row.doc, updatedAt: row.doc?.updatedAt || row.updated_at };
      }
      const { days } = mergeDayMaps(this.store.state.days, remoteDays);

      let settings = this.store.state.settings;
      if (settingsRes.data) {
        const remote = { ...settingsRes.data.doc, updatedAt: settingsRes.data.doc?.updatedAt || settingsRes.data.updated_at };
        const local = { ...settings, updatedAt: settings.updatedAt };
        const m = mergeDoc(local, remote);
        if (m.winner === 'remote') {
          settings = {
            ...settings,
            textSize: remote.textSize ?? settings.textSize,
            style: remote.style ?? settings.style,
            showAnchors: remote.showAnchors ?? settings.showAnchors,
            anchors: remote.anchors ?? settings.anchors,
            foundingInterest: remote.foundingInterest ?? settings.foundingInterest ?? false,
            retention: { ...(settings.retention || {}), ...(remote.retention || {}) },
            updatedAt: remote.updatedAt,
          };
        }
      }

      let templates = this.store.state.templates;
      if (templatesRes.data) {
        const remote = { ...templatesRes.data.doc, updatedAt: templatesRes.data.doc?.updatedAt || templatesRes.data.updated_at };
        const local = { ...templates, updatedAt: templates.updatedAt };
        const m = mergeDoc(local, remote);
        if (m.winner === 'remote') {
          templates = { weekday: remote.weekday ?? templates.weekday, weekend: remote.weekend ?? templates.weekend, listTemplates: remote.listTemplates ?? templates.listTemplates ?? [], updatedAt: remote.updatedAt };
        }
      }

      const stamps = this.store.state.meta.monthNotesUpdatedAt || {};
      const remoteNotes = {};
      for (const row of notesRes.data || []) {
        remoteNotes[row.month_key] = { items: row.doc, updatedAt: row.updated_at };
      }
      const localNotes = {};
      for (const [k, v] of Object.entries(this.store.state.monthNotes || {})) {
        localNotes[k] = { items: v, updatedAt: stamps[k] || null };
      }
      const mergedNotesWrap = mergeMonthNotes(localNotes, remoteNotes);
      const monthNotes = {};
      this.store.state.meta.monthNotesUpdatedAt = this.store.state.meta.monthNotesUpdatedAt || {};
      for (const [k, v] of Object.entries(mergedNotesWrap)) {
        monthNotes[k] = v.items || [];
        this.store.state.meta.monthNotesUpdatedAt[k] = v.updatedAt || null;
      }

      // Entitlement: server subscriptions table wins (clients cannot self-grant Pro)
      applySubscriptionRow(settings, subRes?.data || null);

      this._applyingRemote = true;
      this.store.state.days = days;
      this.store.state.settings = settings;
      this.store.state.templates = templates;
      this.store.state.monthNotes = monthNotes;
      this.store.virtual.clear();
      this.store.adapter.save(this.store.state);
      this.store.emit('sync');
    } finally {
      this._applyingRemote = false;
      this._pulling = false;
    }
  }

  async pushLocal() {
    const sb = getSupabase();
    if (!sb || !this.user || !navigator.onLine) return;
    const uid = this.user.id;
    const snap = snapshotForSync(this.store.state);

    const dayRows = Object.entries(snap.days).map(([day_date, doc]) => ({
      user_id: uid,
      day_date,
      doc,
      updated_at: doc.updatedAt || new Date().toISOString(),
    }));
    if (dayRows.length) {
      const { error } = await sb.from('days').upsert(dayRows, { onConflict: 'user_id,day_date' });
      if (error) throw error;
    }

    if (snap.settings.updatedAt || snap.settings.style) {
      const doc = { ...snap.settings };
      delete doc.plan;
      delete doc.foundingMom;
      delete doc.foundingExpiresAt;
      delete doc.stripeCustomerId;
      delete doc.stripeSubscriptionId;
      delete doc.subscriptionStatus;
      delete doc.currentPeriodEnd;
      const { error } = await sb.from('user_settings').upsert({
        user_id: uid,
        doc,
        updated_at: snap.settings.updatedAt || new Date().toISOString(),
      });
      if (error) throw error;
    }

    if (snap.templates.weekday) {
      const { error } = await sb.from('templates').upsert({
        user_id: uid,
        doc: snap.templates,
        updated_at: snap.templates.updatedAt || new Date().toISOString(),
      });
      if (error) throw error;
    }

    const noteRows = Object.entries(snap.monthNotes).map(([month_key, wrap]) => ({
      user_id: uid,
      month_key,
      doc: Array.isArray(wrap) ? wrap : (wrap.items || []),
      updated_at: (Array.isArray(wrap) ? null : wrap.updatedAt) || new Date().toISOString(),
    }));
    if (noteRows.length) {
      const { error } = await sb.from('month_notes').upsert(noteRows, { onConflict: 'user_id,month_key' });
      if (error) throw error;
    }
  }

  subscribeRealtime() {
    const sb = getSupabase();
    if (!sb || !this.user) return;
    this.unsubscribeRealtime();
    const uid = this.user.id;
    this._channel = sb.channel('momos-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'days', filter: `user_id=eq.${uid}` }, () => this.softPull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${uid}` }, () => this.softPull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'templates', filter: `user_id=eq.${uid}` }, () => this.softPull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'month_notes', filter: `user_id=eq.${uid}` }, () => this.softPull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${uid}` }, () => this.softPull())
      .subscribe();
  }

  softPull() {
    clearTimeout(this._softTimer);
    this._softTimer = setTimeout(() => {
      this.pullRemote()
        .then(() => this.setStatus(SyncStatus.Synced))
        .catch((e) => this.setStatus(SyncStatus.Error, e));
    }, 200);
  }

  unsubscribeRealtime() {
    const sb = getSupabase();
    if (sb && this._channel) { sb.removeChannel(this._channel); this._channel = null; }
  }

  async ensureCalendarToken() {
    const sb = getSupabase();
    if (!sb || !this.user) return null;
    const { data, error } = await sb.rpc('ensure_calendar_token');
    if (error) throw error;
    this.calendarToken = data;
    return data;
  }

  async rotateCalendarToken() {
    const sb = getSupabase();
    if (!sb || !this.user) throw new Error('Sign in first');
    const { data, error } = await sb.rpc('rotate_calendar_token');
    if (error) throw error;
    this.calendarToken = data;
    return data;
  }

  feedUrl() {
    if (!this.calendarToken || !SUPABASE_URL) return '';
    const base = SUPABASE_URL.replace(/\/$/, '');
    return `${base}/functions/v1/ics?token=${this.calendarToken}`;
  }

  webcalUrl() {
    const https = this.feedUrl();
    return https ? https.replace(/^https:/, 'webcal:') : '';
  }
}
