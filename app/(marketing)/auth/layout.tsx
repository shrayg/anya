export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cancel marketing main top padding and fill the viewport under the floating
  // navbar so login/register can sit in true visual center.
  return (
    <div className="auth-layout -mt-20 flex min-h-[calc(100svh-5rem)] flex-1 flex-col justify-center">
      {children}
    </div>
  );
}
