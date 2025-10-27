import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";


export async function POST(req: NextRequest) {
// TODO: provider doğrulama & payload doğrulama
return NextResponse.json({ ok: true });
}