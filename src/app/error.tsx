"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <div className="mb-6 h-1 w-12 bg-gold" />
      <h1 className="text-4xl font-bold text-navy">Something went wrong</h1>
      <p className="mt-4 max-w-md text-base text-navy/60">
        An unexpected error occurred. Please try again or contact us if the
        problem persists.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-navy/40">
          Error: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="mt-8 inline-flex h-12 items-center rounded bg-gold px-7 text-sm font-semibold text-navy transition-colors hover:bg-gold/90"
      >
        Try Again
      </button>
    </div>
  );
}
