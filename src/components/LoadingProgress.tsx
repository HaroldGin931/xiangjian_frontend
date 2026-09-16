// Keep short requests silent. A slow request gets a thin line, never another popup.
export function LoadingProgress({ label = '正在准备内容', onCancel }: { label?: string; onCancel?: () => void }) {
  return <div className="loading-progress" role="status"><span className="visually-hidden">{label}</span>{onCancel && <button type="button" className="loading-cancel" onClick={onCancel}>取消打开</button>}</div>
}
