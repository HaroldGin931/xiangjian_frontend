import { Button } from '@astryxdesign/core/Button'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { TextInput } from '@astryxdesign/core/TextInput'

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
  channels?: VerificationChannel[]
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
      {(props.channels?.length ?? 2) > 1 ? <SegmentedControl
        label="验证方式"
        value={props.channel}
        onChange={(value) => props.setChannel(value as VerificationChannel)}
        layout="fill"
      >
        <SegmentedControlItem value="sms" label="手机号" />
        <SegmentedControlItem value="email" label="邮箱" />
      </SegmentedControl> : null}
      <TextInput
        label={props.channel === 'sms' ? '手机号' : '邮箱'}
        type={props.channel === 'email' ? 'email' : 'text'}
        value={props.contact}
        onChange={props.setContact}
        width="100%"
        isDisabled={props.disabled}
      />
      <div className="code-row">
        <TextInput
          label="验证码"
          value={props.code}
          onChange={props.setCode}
          width="100%"
          isDisabled={props.disabled}
        />
        <Button
          label="获取验证码"
          variant="secondary"
          size="lg"
          clickAction={send}
          isDisabled={!props.contact.trim() || props.disabled}
        />
      </div>
    </>
  )
}
