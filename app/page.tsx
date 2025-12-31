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
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900">
      <div className="z-10 max-w-5xl w-full items-center justify-center text-center animate-fade-in">
        <div className="mb-12 flex justify-center">
          <Logo size="lg" variant="dark" />
        </div>
        <h1 className="text-5xl font-serif font-bold mb-6 text-white tracking-tight">
          Welcome to Planno
        </h1>
        <p className="text-center text-gray-200 mb-10 text-lg">
          Create shareable scheduling links and manage your meetings
        </p>
        <div className="flex justify-center space-x-5">
          <Link
            href="/auth/login"
            className="px-10 py-4 bg-white text-navy-900 rounded-xl hover:bg-gray-50 transition-all font-semibold shadow-2xl hover:shadow-3xl hover:scale-105 active:scale-95"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="px-10 py-4 bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 rounded-xl hover:bg-white/20 hover:border-white/50 transition-all font-semibold shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  )
}

