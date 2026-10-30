const configuredSiteUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://nalik-acadamey.vercel.app";

export const siteUrl = new URL(configuredSiteUrl).origin;
