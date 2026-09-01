import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getContacts } from '@/lib/endpoints'

export function ContactsPage() {
  const { accountId } = useParams<{ accountId: string }>()

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', accountId],
    queryFn: () => getContacts(accountId!),
    enabled: !!accountId,
  })

  if (!accountId) return null

  return (
    <div className="h-full overflow-y-auto p-4">
      {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
      {contacts && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>ID de WhatsApp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name ?? '—'}</TableCell>
                <TableCell>{c.phone ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{c.external_id}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {contacts?.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay contactos todavía.</p>
      )}
    </div>
  )
}
