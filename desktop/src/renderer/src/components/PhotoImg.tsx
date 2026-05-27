import { useEffect, useState } from 'react'

/**
 * Displays a local file-system image by loading it through IPC as a base64
 * data URL. This bypasses Electron's cross-origin block on file:// URLs when
 * the renderer is loaded from http://localhost (dev) or a bundled HTML file.
 */
interface Props {
  src?: string | null
  alt?: string
  className?: string
  style?: React.CSSProperties
  fallback?: React.ReactNode
}

export default function PhotoImg({ src, alt = '', className, style, fallback = null }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    setDataUrl(null)
    if (!src) return
    let cancelled = false
    window.api.photo.getDataUrl(src).then((url) => {
      if (!cancelled) setDataUrl(url)
    })
    return () => { cancelled = true }
  }, [src])

  if (!src) return <>{fallback}</>
  if (!dataUrl) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', ...style }}>
      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
    </div>
  )
  return <img src={dataUrl} alt={alt} className={className} style={style} />
}
