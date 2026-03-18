import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ePromos Order Entry Tracker",
  description: "Time study and order entry process tracker for ePromos",
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
          <header className="bg-[#003087] text-white shadow-md">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              {/* Brand */}
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-[#FF6B00]">e</span>
                <span className="text-lg font-semibold tracking-wide">
                  ePromos Order Entry Tracker
                </span>
              </div>

              {/* Nav + User */}
              <div className="flex items-center gap-6">
                <nav className="flex gap-6 text-sm font-medium">
                  <a href="/" className="hover:text-[#FF6B00] transition-colors">
                    Process Tracker
                  </a>
                  {profile?.is_admin && (
                    <>
                      <a href="/entry-log" className="hover:text-[#FF6B00] transition-colors">
                        Entry Log
                      </a>
                      <a href="/manage-tasks" className="hover:text-[#FF6B00] transition-colors">
                        Manage Tasks
                      </a>
                      <a href="/employees" className="hover:text-[#FF6B00] transition-colors">
                        Admin
                      </a>
                    </>
                  )}
                </nav>

                {/* User info + sign out */}
                <div className="flex items-center gap-3 border-l border-blue-700 pl-6">
                  <div className="text-right">
                    <p className="text-sm font-medium leading-tight">
                      {profile?.name || user.email}
                    </p>
                    {profile?.role && (
                      <p className="text-xs text-blue-300 leading-tight">
                        {profile.role}
                      </p>
                    )}
                  </div>
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="text-xs bg-blue-800 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </header>
        )}

        <main className={user ? "max-w-6xl mx-auto px-4 py-8" : ""}>
          {children}
        </main>
      </body>
    </html>
  );
}
