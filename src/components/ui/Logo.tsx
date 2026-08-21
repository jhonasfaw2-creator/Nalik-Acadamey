import Link from "next/link";
import Image from "next/image";
import { SITE_NAME } from "@/lib/constants";

interface LogoProps {
  className?: string;
  height?: number;
}

export function Logo({ className, height = 36 }: LogoProps) {
  return (
    <Link href="/" className={className}>
      <span className="relative block" style={{ height: `${height}px`, width: "auto" }}>
        <Image
          src="/logo/nalik-acadamey.png"
          alt={SITE_NAME}
          fill
          priority
          className="object-contain"
          sizes="36px"
        />
      </span>
    </Link>
  );
}
