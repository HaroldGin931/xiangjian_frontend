import { BACKEND_BASE, requestJson, type JsonObject } from './http'

export function recordKeyFromUri(uri: string, collection: string) {
  const parts = uri.split('/')
  const collectionIndex = parts.lastIndexOf(collection)
  const recordKey = parts[collectionIndex + 1]
  if (collectionIndex < 0 || !recordKey) throw new Error('记录地址无效')
  return recordKey
}

export function createPdsRecord(
  accessJwt: string,
  body: { repo: string; collection: string; record: JsonObject },
) {
  return requestJson<{ uri: string; cid: string }>(
    `${BACKEND_BASE}/pds/xrpc/com.atproto.repo.createRecord`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

export async function deletePdsRecord(
  accessJwt: string,
  body: { repo: string; collection: string; rkey: string },
) {
  await requestJson(
    `${BACKEND_BASE}/pds/xrpc/com.atproto.repo.deleteRecord`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}
