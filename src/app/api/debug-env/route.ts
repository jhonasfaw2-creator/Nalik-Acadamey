export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    hasPublicKey: !!process.env.CHAPA_PUBLIC_KEY,
    publicKeyPrefix: process.env.CHAPA_PUBLIC_KEY ? process.env.CHAPA_PUBLIC_KEY.slice(0, 12) : null,
    hasSecretKey: !!process.env.CHAPA_SECRET_KEY,
    secretKeyPrefix: process.env.CHAPA_SECRET_KEY ? process.env.CHAPA_SECRET_KEY.slice(0, 12) : null,
    nodeEnv: process.env.NODE_ENV,
  });
}
