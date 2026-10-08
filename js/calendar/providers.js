import { buildICS } from './ics.js';

/**
 * Calendar sync providers. Each one receives the same normalised events
 * (see events.js). Only file export works today; the others document the
 * seam for a future backend.
 */
export const providers = {
  icsDownload: {
    id: 'icsDownload', label: 'Download .ics file', available: true,
    async export(events, { filename, calName, alarmMinutes }) {
      const ics = buildICS(events, { calName, alarmMinutes });
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return { ok: true, count: events.length, ics };
    },
  },
  icsShare: {
    id: 'icsShare', label: 'Share to Calendar…',
    get available() {
      try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.ics', { type: 'text/calendar' })] })); }
      catch { return false; }
    },
    async export(events, { filename, calName, alarmMinutes }) {
      const ics = buildICS(events, { calName, alarmMinutes });
      const file = new File([ics], filename, { type: 'text/calendar' });
      await navigator.share({ files: [file], title: calName });
      return { ok: true, count: events.length, ics };
    },
  },
  // ---- planned ----
  subscriptionFeed: {
    id: 'subscriptionFeed', label: 'Live iCloud subscription (webcal://)', available: false,
    plan: 'Needs a tiny backend: sync planner data up, then serve buildICS(collectEvents(range)) at a secret URL like /feeds/<token>.ics. iCloud Calendar subscribes via webcal:// and refreshes on its own schedule. Stable UIDs (itemId@jb-planner) mean edits update in place.',
  },
  caldav: {
    id: 'caldav', label: 'Two-way iCloud sync (CalDAV)', available: false,
    plan: 'Server-side CalDAV client using an Apple app-specific password: PUT one VEVENT per timed item to caldav.icloud.com keyed by the same UID, DELETE when the item is removed, and poll REPORT for changes made in Calendar.',
  },
};
