import { DashboardAuthProvider } from "@/components/dashboard/dashboard-auth-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardAuthProvider>{children}</DashboardAuthProvider>;
}
