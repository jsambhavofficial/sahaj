import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Sahaj AI — Early Warning & Eldercare Decision Support Platform",
  description: "Enterprise decision support platform for Organization Admins, City Managers, and Care Coordinators.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppProvider>
            <AppShell>{children}</AppShell>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

