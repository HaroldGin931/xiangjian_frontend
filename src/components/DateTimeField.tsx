import { nextTimeSlot } from '~/lib/date-time'

const times = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, '0')}:${String(index % 4 * 15).padStart(2, '0')}`)

export function DateTimeField({ label, value, onChange, min, max, disabled = false, required = false }: {
  label: string; value: string; onChange: (value: string) => void; min?: string; max?: string; disabled?: boolean; required?: boolean
}) {
  const [date = '', time = ''] = value.split('T')
  const valid = (day: string, slot: string) => (!min || `${day}T${slot}` >= min) && (!max || `${day}T${slot}` <= max)
  const changeDate = (day: string) => {
    if (!day) { onChange(''); return }
    const boundedDay = day < (min?.slice(0, 10) ?? '') ? min!.slice(0, 10) : max && day > max.slice(0, 10) ? max.slice(0, 10) : day
    const available = times.filter(slot => valid(boundedDay, slot))
    const preferred = time || nextTimeSlot().slice(11)
    const slot = available.find(item => item >= preferred) ?? available.at(-1)
    if (slot) onChange(`${boundedDay}T${slot}`)
  }
  return <div className="native-field"><span>{label}（北京时间）</span><div className="code-row">
    <input type="date" aria-label={`${label}日期（北京时间）`} value={date} min={min?.slice(0, 10)} max={max?.slice(0, 10)} disabled={disabled} required={required} onChange={event => changeDate(event.target.value)} />
    <select aria-label={`${label}时刻（北京时间）`} value={time} disabled={disabled || !date} required={required} onChange={event => onChange(`${date}T${event.target.value}`)}>
      {!time && <option value="">选择时间</option>}
      {times.map(slot => <option key={slot} value={slot} disabled={!valid(date, slot)}>{slot}</option>)}
    </select>
  </div></div>
}
