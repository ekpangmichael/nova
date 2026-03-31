import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface flex flex-col items-center justify-center selection:bg-secondary/30 relative overflow-hidden">
      {/* Background layers */}
      <div className="auth-grid fixed inset-0 z-0 pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-gradient-to-tr from-surface via-transparent to-surface-container-high/10 pointer-events-none" />
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-secondary/[0.03] blur-[100px]" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-tertiary/[0.02] blur-[80px]" />
      </div>

      {/* Content */}
      <main className="relative z-10 w-full max-w-[420px] px-6 py-12">
        {children}
      </main>

      {/* Bottom scan line */}
      <div className="fixed bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-secondary/20 to-transparent" />
    </div>
  );
}
