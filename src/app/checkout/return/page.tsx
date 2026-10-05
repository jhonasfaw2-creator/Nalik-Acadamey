import CheckoutReturnClient from "./CheckoutReturnClient";

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ tx_ref?: string | string[]; merchant_reference?: string | string[] }>;
}) {
  const params = await searchParams;
  const txRefValue = params.tx_ref ?? params.merchant_reference ?? "";
  const txRef = Array.isArray(txRefValue) ? txRefValue[0] ?? "" : txRefValue;

  return <CheckoutReturnClient txRef={txRef} />;
}
