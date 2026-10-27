// Shared by the browser and the schedule regression tests.
(function (root) {
  function archiveTime(sermon) {
    const start = Date.parse(sermon.scheduledStartTime);
    return Number.isFinite(start) ? start + 90 * 60 * 1000 : null;
  }
  function isUpcoming(sermon, now = Date.now()) {
    const transition = archiveTime(sermon);
    if (transition !== null) return now < transition;
    // Older archive entries have dates only. Preserve same-day archive behavior.
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(now));
    return /^\d{4}-\d{2}-\d{2}$/.test(sermon.date || '') && sermon.date > today;
  }
  function partition(sermons, now = Date.now()) {
    const upcoming = [], archive = [];
    sermons.forEach(sermon => (isUpcoming(sermon, now) ? upcoming : archive).push(sermon));
    upcoming.sort((a, b) => (Date.parse(a.scheduledStartTime) || Date.parse(a.date)) - (Date.parse(b.scheduledStartTime) || Date.parse(b.date)));
    return { upcoming, archive };
  }
  const api = { archiveTime, isUpcoming, partition };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SermonSchedule = api;
})(globalThis);
