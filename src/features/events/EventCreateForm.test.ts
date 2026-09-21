import { expect, it } from 'vitest'
import { changeEventTime, eventDurationLabel, eventTimeError } from './EventCreateForm'
import { beijingTime } from '~/lib/date-time'

it('matches the event deadline and interval rules without accepting the current minute as future', () => {
  const now = beijingTime('2026-09-21T12:00') + 30_000
  const times = { application_deadline: '2026-09-21T13:00', starts_at: '2026-09-21T13:00', ends_at: '2026-09-21T14:00' }
  expect(eventTimeError(times, now)).toBeNull()
  expect(eventTimeError({ ...times, application_deadline: '2026-09-21T12:00' }, now)).toContain('晚于当前时间')
  expect(eventTimeError({ ...times, application_deadline: '2026-09-21T13:01' }, now)).toContain('报名截止不能晚于')
  expect(eventTimeError({ ...times, ends_at: times.starts_at }, now)).toContain('结束时间必须晚于')
  expect(eventTimeError({ ...times, starts_at: '' }, now)).toContain('完整、有效')
})

it('moves an overlapping start forward with the deadline and preserves duration across days', () => {
  const fields = { application_deadline: '2026-10-01T10:00', starts_at: '2026-10-01T11:00', ends_at: '2026-10-01T13:00' }
  const corrected = changeEventTime(fields, 'application_deadline', '2026-10-01T23:30', '120')
  expect(corrected).toEqual({ application_deadline: '2026-10-01T23:30', starts_at: '2026-10-01T23:30', ends_at: '2026-10-02T01:30' })
  expect(eventTimeError(corrected, beijingTime('2026-10-01T09:00'))).toBeNull()
  const moved = changeEventTime(corrected, 'starts_at', '2026-10-03T12:00', '2880')
  expect(moved.ends_at).toBe('2026-10-05T12:00')
  expect(eventDurationLabel(moved)).toBe('2 天')
  const custom = changeEventTime(moved, 'ends_at', '2026-10-05T14:15', 'custom')
  expect(eventDurationLabel(custom)).toBe('2 天 2 小时 15 分钟')
  expect(changeEventTime(custom, 'starts_at', '2026-10-04T12:00', 'custom').ends_at).toBe('2026-10-06T14:15')
})
