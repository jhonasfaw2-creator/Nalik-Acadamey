import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Container as="main" className="flex flex-1 flex-col items-center justify-center py-32 text-center">
      <div className="mb-6 h-1 w-12 bg-gold" />
      <h1 className="text-7xl font-bold text-navy">404</h1>
      <p className="mt-5 text-lg text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link href="/" className="mt-10">
        <Button>Back to Home</Button>
      </Link>
    </Container>
  );
}
