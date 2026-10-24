export function normalizeEthiopianPhone(phone: string): string | null {
  const compact = phone.replace(/[\s()-]/g, "");
  if (/^\+251[79]\d{8}$/.test(compact)) return compact;
  if (/^251[79]\d{8}$/.test(compact)) return `+${compact}`;
  if (/^0[79]\d{8}$/.test(compact)) return `+251${compact.slice(1)}`;
  return null;
}
