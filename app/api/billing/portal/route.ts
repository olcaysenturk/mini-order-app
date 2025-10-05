import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";


export async function POST(_req: NextRequest) {
const session = await getServerSession(authOptions);
const tenantId = (session as any)?.tenantId as string | undefined;
if (!tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
// const url = await createBillingPortalOnProvider(tenantId)
const url = `/settings/billing?portal=mock`;
return NextResponse.json({ url });
}