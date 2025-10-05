import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PROTECTED = [
  '/admin',
  '/order',
  '/orders',
  '/customers',
  '/reports',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Korunan rota değilse geç
  if (!PROTECTED.some(p => pathname.startsWith(p))) return NextResponse.next()

  // JWT var mı?
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (token) return NextResponse.next()

  // Yoksa login'e yönlendir
  const url = new URL('/login', req.url)
  url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(url)
}

// Hangi yollar dinlenecek
export const config = {
  matcher: [
    '/admin/:path*',
    '/order/:path*',
    '/orders/:path*',
    '/customers/:path*',
    '/reports/:path*',
  ],
}
