import { Check, Copy } from 'lucide-react'
import * as React from 'react'

export function TemporaryPasswordField({ password }: { password: string }) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2.5">
      <code className="min-w-0 flex-1 font-mono text-[13px] break-all">{password}</code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copiar contraseña temporal"
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
      </button>
    </div>
  )
}
