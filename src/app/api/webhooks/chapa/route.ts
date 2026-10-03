// Compatibility route: the Chapa dashboard's callback_url points at
// /api/webhooks/chapa (the pre-migration path). Delegate to the canonical
// /api/payments/webhook handler so there is exactly one implementation and no
// webhook is lost while the dashboard still points here.

export const dynamic = "force-dynamic";

export { POST } from "@/app/api/payments/webhook/route";
