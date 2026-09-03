import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Hapus cookie auth
  response.cookies.delete('auth');
  
  return response;
}
