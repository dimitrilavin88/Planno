import Link from 'next/link'
import { getAuthUser } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import Logo from '@/components/logo'

export default async function Home() {
  const user = await getAuthUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 bg-gradient-to-br from-slate-100 via-blue-50 to-gray-100">
      <div className="z-10 max-w-5xl w-full items-center justify-center text-center animate-fade-in">
        <div className="mb-8 sm:mb-12 flex justify-center">
          <Logo size="lg" variant="light" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-4 sm:mb-6 text-navy-900 tracking-tight px-2">
          Welcome to Planno
        </h1>
        <p className="text-center text-gray-700 mb-8 sm:mb-10 text-base sm:text-lg px-2">
          Create shareable scheduling links and manage your meetings
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-5 sm:space-x-0">
          <Link
            href="/auth/login"
            className="w-full sm:w-auto px-10 py-4 min-h-[48px] flex items-center justify-center bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-all font-semibold shadow-2xl hover:shadow-3xl hover:scale-[1.02] active:scale-[0.98]"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="w-full sm:w-auto px-10 py-4 min-h-[48px] flex items-center justify-center bg-white text-navy-900 border-2 border-navy-200 rounded-xl hover:bg-navy-50 hover:border-navy-300 transition-all font-semibold shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  )
}

