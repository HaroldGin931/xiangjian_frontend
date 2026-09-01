import type { VerificationChannel, VerificationPurpose } from './api'
import { sendVerificationCode } from './api'

type Props = {
  channel: VerificationChannel
  setChannel: (channel: VerificationChannel) => void
  contact: string
  setContact: (contact: string) => void
  code: string
  setCode: (code: string) => void
  purpose: VerificationPurpose
  disabled?: boolean
  onError: (message: string) => void
  onSent?: () => void
}

export function VerificationFields(props: Props) {
  const send = async () => {
    props.onError('')
    try {
      await sendVerificationCode({
        data: {
          channel: props.channel,
          purpose: props.purpose,
          ...(props.channel === 'sms'
            ? { phone: props.contact, phoneRegion: '86' }
            : { email: props.contact }),
        },
      })
      props.onSent?.()
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : '验证码发送失败')
    }
  }

  return (
    <>
      <div className="segmented-control" aria-label="验证方式">
        <button type="button" className={props.channel === 'sms' ? 'active' : ''} onClick={() => props.setChannel('sms')}>手机号</button>
        <button type="button" className={props.channel === 'email' ? 'active' : ''} onClick={() => props.setChannel('email')}>邮箱</button>
      </div>
      <label className="field-label">
        <span>{props.channel === 'sms' ? '手机号' : '邮箱'}</span>
        <input
          type={props.channel === 'sms' ? 'tel' : 'email'}
          value={props.contact}
          onChange={(event) => props.setContact(event.target.value)}
          autoComplete={props.channel === 'sms' ? 'tel' : 'email'}
        />
      </label>
      <label className="field-label code-field">
        <span>验证码</span>
        <div>
          <input value={props.code} onChange={(event) => props.setCode(event.target.value)} inputMode="numeric" />
          <button type="button" className="secondary-button" disabled={!props.contact.trim() || props.disabled} onClick={send}>获取验证码</button>
        </div>
      </label>
    </>
  )
}
