"use client";

import { use } from "react";
import { SectionEditor } from "@/components/admin/SectionEditor";
import { SECTION_CONFIGS } from "@/lib/admin/sections";

export default function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = use(params);
  const config = SECTION_CONFIGS[section];

  if (!config) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold text-navy">Section Not Found</h1>
        <p className="mt-2 text-sm text-navy/50">
          The section &ldquo;{section}&rdquo; does not exist.
        </p>
      </div>
    );
  }

  return <SectionEditor config={config} />;
}
