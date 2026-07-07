// Auth screens talk to Supabase at runtime; never prerender them statically.
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
