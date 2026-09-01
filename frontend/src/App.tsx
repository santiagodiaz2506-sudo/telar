import { Navigate, Route, Routes } from 'react-router-dom'

import { AccountLayout } from '@/routes/AccountLayout'
import { AccountPickerPage } from '@/routes/AccountPickerPage'
import { ContactsPage } from '@/routes/ContactsPage'
import { ConversationDetailPage } from '@/routes/ConversationDetailPage'
import { ConversationsPage } from '@/routes/ConversationsPage'
import { LoginPage } from '@/routes/LoginPage'
import { RootRedirect } from '@/routes/RootRedirect'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />
      <Route path="/accounts" element={<AccountPickerPage />} />
      <Route path="/accounts/:accountId" element={<AccountLayout />}>
        <Route index element={<Navigate to="conversations" replace />} />
        <Route path="conversations" element={<ConversationsPage />} />
        <Route path="conversations/:conversationId" element={<ConversationDetailPage />} />
        <Route path="contacts" element={<ContactsPage />} />
      </Route>
    </Routes>
  )
}

export default App
