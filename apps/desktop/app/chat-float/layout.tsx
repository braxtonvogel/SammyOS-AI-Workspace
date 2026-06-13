// app/chat-float/layout.tsx
// Returns just children — no <html><body>, no SammyShell.
// The root layout.tsx detects /chat-float via usePathname() and skips SammyShell there.
// This avoids the hydration error caused by nesting <html><body> inside the root <html><body>.
export default function ChatFloatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}