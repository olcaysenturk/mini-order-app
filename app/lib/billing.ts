import { prisma } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { redirect } from "next/navigation";


export async function ensureSubscriptionRow(tenantId: string) {
const sub = await prisma.subscription.findUnique({ where: { tenantId } });
if (sub) return sub;
// Yeni tenant için başlangıç: trialing + FREE plan (veya doğrudan PRO'ya yönlendirme)
return prisma.subscription.create({
data: {
tenantId,
plan: "FREE",
status: "trialing",
currentPeriodStart: new Date(),
currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 gün trial örneği
seats: 1,
},
});
}


export async function getActiveSubscription(tenantId: string) {
return prisma.subscription.findUnique({ where: { tenantId } });
}


export function isSubscriptionActive(sub: { status: string; currentPeriodEnd: Date | null; graceUntil: Date | null }) {
const now = new Date();
if (!sub) return false as any;
if (sub.status === "active" || sub.status === "trialing") return true;
if (sub.status === "past_due" && sub.graceUntil && sub.graceUntil > now) return true; // grace içinde
return false;
}


export async function requireActiveSubscription() {
const session = await getServerSession(authOptions);
const tenantId = (session as any)?.tenantId as string | undefined;
if (!tenantId) redirect("/login");


const sub = await prisma.subscription.findUnique({ where: { tenantId } });
if (!sub || !isSubscriptionActive(sub as any)) {
redirect("/settings/billing?needPayment=1");
}
return sub;
}


export async function countSeats(tenantId: string) {
// Üyelik sayısını koltuk (seat) olarak yorumla
const seats = await prisma.membership.count({ where: { tenantId } });
return seats;
}