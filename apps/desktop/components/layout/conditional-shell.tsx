"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import SammyShell from "./sammy-shell";
import { useAuthStore } from "@/lib/auth-store";

const PUBLIC_PATHS = ["/login", "/chat-float"]; // ← added "/chat-float"

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!PUBLIC_PATHS.includes(pathname) && !user) {
      const t = setTimeout(() => {
        if (!useAuthStore.getState().user) {
          router.replace("/login");
        }
      }, 150);
      return () => clearTimeout(t);
    }
  }, [user, pathname, router]);

  if (pathname === "/chat-float") {
    return (
      <div style={{
        margin: 0, padding: 0, background: "#0d0d0f",
        height: "100vh", overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        {children}
      </div>
    );
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!user) {
    return <div style={{ background: "#080809", minHeight: "100vh" }} />;
  }

  return <SammyShell>{children}</SammyShell>;
}