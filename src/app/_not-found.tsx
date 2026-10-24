import Link from "next/link";

export default function NotFound() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-navy text-white">
      <div className="px-6 text-center">
        <h1 className="text-6xl font-bold tracking-tight">404</h1>
        <p className="mt-4 text-lg text-white/70">
          Page not found
        </p>
        <Link
          href="/"
          className="action-primary mt-8 inline-flex items-center gap-2"
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}
