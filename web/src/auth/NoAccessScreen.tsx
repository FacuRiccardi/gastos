import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { strings } from '@/strings'

export function NoAccessScreen({
  onCheckAgain,
  onSignOut,
  error,
}: {
  onCheckAgain: () => void
  onSignOut: () => void
  error?: string | null
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{strings.noAccess.title}</CardTitle>
          <CardDescription>{strings.noAccess.message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button onClick={onCheckAgain}>{strings.noAccess.checkAgain}</Button>
          <Button variant="outline" onClick={onSignOut}>
            {strings.noAccess.signOut}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
