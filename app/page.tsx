import Link from 'next/link'
import { getAuthUser } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'

export default async function Home() {
  const user = await getAuthUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm">
        <h1 className="text-4xl font-serif font-bold text-center mb-8 text-navy-900">
          Welcome to Planno
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Create shareable scheduling links and manage your meetings
        </p>
        <div className="flex justify-center space-x-4">
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-navy-900 text-white rounded-md hover:bg-navy-800 transition-colors font-medium"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="px-6 py-3 bg-white text-navy-900 border-2 border-navy-900 rounded-md hover:bg-navy-50 transition-colors font-medium"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  )
}

