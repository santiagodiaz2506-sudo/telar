import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { getAccounts } from '@/lib/endpoints'

export function AccountPickerPage() {
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  })

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-lg font-semibold">Elegí una cuenta</h1>
      {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
      <div className="flex flex-col gap-2">
        {accounts?.map((account) => (
          <Link key={account.id} to={`/accounts/${account.id}/conversations`}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle className="text-base font-medium">{account.name}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
