import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { IconButton } from '@astryxdesign/core/IconButton'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import QRCode from 'react-qr-code'
import { QrCode, ScanLine } from 'lucide-react'
import { DetailDialog } from '~/components/DetailDialog'
import { Avatar } from '~/components/Avatar'
import { integerInputError } from '~/lib/integer-input'
import type { RicePublicUser, RiceSession } from '~/lib/models'
import { readStoredSession, useStoredSession } from '../session/session'
import { LoginLink } from '../session/LoginLink'
import { getTransferRecipient, sendPersonalGrains, type PersonalTransfer } from './api'
import { GrainScannerDialog } from './GrainScannerDialog'

export function grainReceiveLink(origin: string, did: string) {
  return `${origin}/profile/${encodeURIComponent(did)}?send=1`
}

export function PersonalGrainActions({ to, initialSend = false }: { to?: string; initialSend?: boolean }) {
  const { session } = useStoredSession()
  const [panel, setPanel] = useState<'send' | 'receive' | null>(initialSend ? 'send' : null)
  const [copyError, setCopyError] = useState('')
  const [copied, setCopied] = useState(false)
  if (!session) return initialSend ? <LoginLink className="primary-link">登录后发送稻米</LoginLink> : null
  const own = !to || to === session.pds.did
  const link = grainReceiveLink(typeof window === 'undefined' ? '' : window.location.origin, session.pds.did)
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setCopyError('') }
    catch { setCopyError('未能复制，请手动复制下方链接。') }
  }
  return <>
    <div className="personal-grain-actions">
      <Button label="发送稻米" variant="ghost" onClick={() => setPanel('send')}>
        <span className="grain-action-content"><span className="grain-action-icon"><ScanLine size={22} aria-hidden="true" /></span><span>发送稻米</span></span>
      </Button>
      {own && <Button label="接收稻米" variant="ghost" onClick={() => { setCopied(false); setCopyError(''); setPanel('receive') }}>
        <span className="grain-action-content"><span className="grain-action-icon"><QrCode size={22} aria-hidden="true" /></span><span>接收稻米</span></span>
      </Button>}
    </div>
    {panel === 'send' && <SendGrainDialog key={session.token} session={session} to={own ? undefined : to} onClose={() => setPanel(null)} />}
    {panel === 'receive' && <DetailDialog title="接收稻米" onClose={() => setPanel(null)}>
      <div className="page business-panel form-stack">
        <div style={{ background: 'white', padding: 16, alignSelf: 'center' }}><QRCode value={link} size={180} title="个人稻米接收码" /></div>
        <strong>@{session.user.handle}</strong><p>请对方扫描接收码，核对收款人后发送稻米。</p>
        <a href={link} style={{ overflowWrap: 'anywhere' }}>{link}</a>
        {copyError && <p className="inline-error" role="alert">{copyError}</p>}
        <div className="form-actions"><Button label={copied ? '已复制' : '复制接收链接'} variant="primary" clickAction={copy} /></div>
      </div>
    </DetailDialog>}
  </>
}

function SendGrainDialog({ session, to, onClose }: { session: RiceSession; to?: string; onClose: () => void }) {
  const [identifier, setIdentifier] = useState(to ?? '')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [recipient, setRecipient] = useState<RicePublicUser | null>(null)
  const [receipt, setReceipt] = useState<PersonalTransfer | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [scanning, setScanning] = useState(false)
  const receiveCode = useCallback((value: string) => { setIdentifier(value); setScanning(false); setError('') }, [])
  const pending = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const current = () => mounted.current && readStoredSession()?.token === session.token
  const amountError = amount ? integerInputError(amount, '发送金额', 1) : null
  const cancelConfirmation = () => {
    if (pending.current) return
    if (uncertain) { onClose(); return }
    setRecipient(null); setError('')
  }
  const run = async () => {
    if (!current() || pending.current || !identifier.trim() || !amount || amountError || uncertain) return
    pending.current = true; setBusy(true); setError('')
    try {
      if (!recipient) {
        const user = await getTransferRecipient({ data: { token: session.token, identifier } })
        if (user.did === session.pds.did) throw new Error('不能转给自己。')
        if (current()) setRecipient(user)
      } else {
        const result = await sendPersonalGrains({ data: { token: session.token, to: recipient.id, amount: Number(amount), memo } })
        if (current()) { window.dispatchEvent(new Event('rice-changed')); setReceipt(result) }
      }
    } catch (reason) {
      if (current()) {
        setError(reason instanceof Error ? reason.message : '发送失败。')
        // No automatic retry: this existing transfer API has no idempotency key.
        if (recipient) setUncertain(true)
      }
    } finally { pending.current = false; if (current()) setBusy(false) }
  }
  return <DetailDialog title="发送稻米" onClose={() => { if (!pending.current) onClose() }}>
    <div className="page business-panel form-stack">
      {receipt ? <><strong role="status">已向 @{receipt.to.handle} 发送 {receipt.amount} 稻米</strong><Link to="/me/grains" onClick={onClose}>查看稻米明细</Link><div className="form-actions"><Button label="完成" variant="primary" onClick={onClose} /></div></> : <>
        <p className="muted">个人测试稻米</p>
        <div className="grain-recipient-field">
          <TextInput label="收款人" value={identifier} onChange={setIdentifier} description="填写手机号、完整用户名或 DID。" isDisabled={busy || !!recipient || uncertain} width="100%" />
          <IconButton label="扫描收款码" icon={<ScanLine size={22} />} variant="ghost" isDisabled={busy || !!recipient || uncertain} onClick={() => setScanning(true)} />
        </div>
        <TextInput label="发送金额" value={amount} onChange={setAmount} status={amountError ? { type: 'error', message: amountError } : undefined} isDisabled={busy || !!recipient || uncertain} width="100%" />
        <TextInput label="留言" value={memo} onChange={setMemo} isDisabled={busy || !!recipient || uncertain} width="100%" isOptional />
        {!recipient && <>{error && <p className="inline-error" role="alert">{error}</p>}<div className="form-actions"><Button label="下一步" variant="primary" isLoading={busy} isDisabled={busy || !identifier.trim() || !amount || !!amountError} clickAction={run} /></div></>}
      </>}
    </div>
    {scanning && <GrainScannerDialog onRead={receiveCode} onClose={() => setScanning(false)} />}
    {recipient && !receipt && <DetailDialog title="确认发送稻米" className="post-dialog business-dialog compose-close-dialog" onClose={cancelConfirmation}>
      <div className="business-panel form-stack">
        <section><Avatar name={recipient.nickname || recipient.handle} src={recipient.avatar?.url} /><strong>{recipient.nickname || recipient.handle}</strong><p>@{recipient.handle}</p><p>确认发送 {amount} 稻米？</p></section>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {uncertain ? <p role="alert">转账结果尚未确认，请先<Link to="/me/grains" onClick={onClose}>查看稻米明细</Link>，确认未扣款后再重新发送。</p> : <div className="form-actions">
          <Button label="返回修改" variant="secondary" isDisabled={busy} onClick={cancelConfirmation} />
          <Button label="确认发送" variant="primary" isLoading={busy} isDisabled={busy} clickAction={run} />
        </div>}
      </div>
    </DetailDialog>}
  </DetailDialog>
}
