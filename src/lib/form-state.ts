import { useEffect, useState } from 'react'

export type FormCloseState = { dirty: boolean; busy: boolean }

// Server drafts are the saved baseline; unsaved edits stay in this account's mounted form.
export function useFormCloseState(snapshot: string, ready: boolean, busy: boolean, notify?: (state: FormCloseState) => void) {
  const [saved, setSaved] = useState<string | null>(null)
  useEffect(() => {
    if (ready && saved === null) setSaved(snapshot)
    notify?.({ dirty: saved !== null && saved !== snapshot, busy })
  }, [snapshot, ready, busy, notify, saved])
  return () => { setSaved(snapshot); notify?.({ dirty: false, busy: false }) }
}
