import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/api/health'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();
  if (!req.cookies.get('fl_session')) {
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = '';
    return NextResponse.redirect(url);
  }
  const h = new Headers(req.headers); h.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers: h } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
