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
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-black">
      <div className="z-10 max-w-5xl w-full items-center justify-center text-center">
        <div className="mb-12 flex justify-center">
          <Logo size="lg" variant="dark" />
        </div>
        <h1 className="text-4xl font-serif font-bold mb-8 text-white">
          Welcome to Planno
        </h1>
        <p className="text-center text-gray-300 mb-8">
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

