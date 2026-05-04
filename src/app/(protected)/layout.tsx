import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/common/AppSidebar'
import { AppHeader } from '@/components/common/AppHeader'
import { PrivacyProvider } from '@/contexts/privacy'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <PrivacyProvider>
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader userEmail={user.email} />
          <main className="flex-1 p-6 max-w-[1200px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </PrivacyProvider>
  )
}
