import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { strings } from '@/strings'

// A screen that could not load: the message and a button to try again (the data is read again from scratch).
export function ScreenError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="grid justify-items-center gap-3 py-8 text-center">
      <p className="text-destructive">{children}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>
        {strings.retry}
      </Button>
    </div>
  )
}
