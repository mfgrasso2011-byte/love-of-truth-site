const test = require('node:test');
const assert = require('node:assert/strict');
const { isUpcoming, partition } = require('../sermon-schedule.js');
const sermon = { id: 'pm', date: '2026-11-01', scheduledStartTime: '2026-11-02T01:00:00.000Z', book: '2 Samuel' };
test('PM sermon remains upcoming through worship, then moves exactly once at 90 minutes', () => {
  const rows = [sermon, { id: 'old', date: '2020-01-01', book: '2 Samuel' }];
  const before = partition(rows, Date.parse('2026-11-02T02:29:59Z'));
  assert.deepEqual(before.upcoming.map(x => x.id), ['pm']);
  assert.equal(before.archive.length, 1);
  const after = partition(rows, Date.parse('2026-11-02T02:30:00Z'));
  assert.equal(after.upcoming.length, 0);
  assert.equal(after.archive.length, 2);
  assert.equal(new Set([...after.upcoming, ...after.archive].map(x => x.id)).size, 2);
});
test('morning and evening services transition independently on the same date', () => {
  const am = { ...sermon, id: 'am', scheduledStartTime: '2026-11-01T18:30:00Z' };
  const groups = partition([sermon, am], Date.parse('2026-11-01T20:00:00Z'));
  assert.deepEqual(groups.upcoming.map(x => x.id), ['pm']);
  assert.deepEqual(groups.archive.map(x => x.id), ['am']);
});
test('absolute timestamps respect the daylight saving change', () => {
  const summer = { ...sermon, scheduledStartTime: '2026-10-26T00:00:00Z' };
  assert.equal(isUpcoming(summer, Date.parse('2026-10-26T01:29:59Z')), true);
  assert.equal(isUpcoming(summer, Date.parse('2026-10-26T01:30:00Z')), false);
});
test('legacy and invalid dates preserve the archive without crashing', () => {
  const now = Date.parse('2026-11-02T01:00:00Z'); // Still Sunday in California.
  assert.equal(isUpcoming({ date: '2026-11-01' }, now), false);
  assert.equal(isUpcoming({ date: '2026-11-02' }, now), true);
  assert.equal(isUpcoming({ date: '2020-01-01', scheduledStartTime: 'invalid' }, now), false);
  assert.equal(isUpcoming({}, now), false);
});
test('upcoming list is chronological regardless of archive ordering', () => {
  const earlier = { ...sermon, id: 'earlier', scheduledStartTime: '2026-11-01T18:30:00Z' };
  assert.deepEqual(partition([sermon, earlier], Date.parse('2026-10-27T12:00:00Z')).upcoming.map(x => x.id), ['earlier', 'pm']);
});

test('only the nearest service date is shown, with later weeks stored in the queue', () => {
  const am = { ...sermon, id: 'am', scheduledStartTime: '2026-11-01T18:30:00Z' };
  const next = { ...sermon, id: 'next', date: '2026-11-08', scheduledStartTime: '2026-11-09T01:00:00Z' };
  const later = { ...sermon, id: 'later', date: '2026-11-15', scheduledStartTime: '2026-11-16T01:00:00Z' };
  const rows = [later, next, sermon, am, { id: 'old', date: '2020-01-01' }];
  const before = partition(rows, Date.parse('2026-10-27T12:00:00Z'));
  assert.deepEqual(before.upcoming.map(x => x.id), ['am', 'pm']);
  assert.deepEqual(before.queued.map(x => x.id), ['next', 'later']);
  assert.deepEqual(before.archive.map(x => x.id), ['old']);
  const afterAM = partition(rows, Date.parse('2026-11-01T20:00:00Z'));
  assert.deepEqual(afterAM.upcoming.map(x => x.id), ['pm']);
  assert.deepEqual(afterAM.queued.map(x => x.id), ['next', 'later']);
  const afterPM = partition(rows, Date.parse('2026-11-02T02:30:00Z'));
  assert.deepEqual(afterPM.upcoming.map(x => x.id), ['next']);
  assert.deepEqual(afterPM.queued.map(x => x.id), ['later']);
  assert.deepEqual(afterPM.archive.map(x => x.id), ['pm', 'am', 'old']);
  assert.equal(new Set([...afterPM.upcoming, ...afterPM.queued, ...afterPM.archive].map(x => x.id)).size, rows.length);
  const final = partition(rows, Date.parse('2026-11-16T02:30:00Z'));
  assert.equal(final.upcoming.length, 0);
  assert.equal(final.queued.length, 0);
  assert.equal(final.archive.length, rows.length);
});
test('a gap between scheduled dates does not lose the next queued sermon', () => {
  const later = { ...sermon, id: 'later', date: '2026-11-22', scheduledStartTime: '2026-11-23T01:00:00Z' };
  const groups = partition([sermon, later], Date.parse('2026-11-02T02:30:00Z'));
  assert.deepEqual(groups.upcoming.map(x => x.id), ['later']);
  assert.equal(groups.archive.length, 1);
});
