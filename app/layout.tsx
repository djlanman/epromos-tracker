import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase";
import Logo from "@/components/Logo";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ePromos Time Study",
  description: "Time study and process tracker for ePromos",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        {user && (
          <header className="bg-[#1A3C28] text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
              {/* Brand */}
              <Logo size="small" white />

              {/* Nav + User */}
              <div className="flex items-center gap-6">
                <nav className="flex gap-6 text-sm font-medium">
                  <a href="/" className="hover:text-[#4CA868] transition-colors">
                    Process Tracker
                  </a>
                  {profile?.is_admin && (
                    <>
                      <a href="/entry-log" className="hover:text-[#4CA868] transition-colors">
                        Entry Log
                      </a>
                      <a href="/reports" className="hover:text-[#4CA868] transition-colors">
                        Reports
                      </a>
                      <a href="/manage-tasks" className="hover:text-[#4CA868] transition-colors">
                        Manage Tasks
                      </a>
                      <a href="/employees" className="hover:text-[#4CA868] transition-colors">
                        Admin
                      </a>
                    </>
                  )}
                </nav>

                {/* User info + sign out */}
                <div className="flex items-center gap-3 border-l border-green-800 pl-6">
                  <div className="text-right">
                    <p className="text-sm font-medium leading-tight">
                      {profile?.name || user.email}
                    </p>
                    {profile?.role && (
                      <p className="text-xs text-green-300 leading-tight">
                        {profile.role}
                      </p>
                    )}
                  </div>
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="text-xs bg-green-900 hover:bg-green-800 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </header>
        )}

        <main className={user ? "max-w-7xl mx-auto px-4 py-8" : ""}>
          {children}
        </main>
      </body>
    </html>
  );
}
