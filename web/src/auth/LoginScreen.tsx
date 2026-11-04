import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { strings } from '@/strings'

export function LoginScreen({ onSignIn, error }: { onSignIn: () => void; error: string | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{strings.login.title}</CardTitle>
          <CardDescription>{strings.login.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button onClick={onSignIn}>{strings.login.button}</Button>
        </CardContent>
      </Card>
    </main>
  )
}
