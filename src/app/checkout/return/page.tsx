import CheckoutReturnClient from "./CheckoutReturnClient";

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ tx_ref?: string | string[] }>;
}) {
  const params = await searchParams;
  const txRef = Array.isArray(params.tx_ref) ? params.tx_ref[0] ?? "" : params.tx_ref ?? "";

  return <CheckoutReturnClient txRef={txRef} />;
}
