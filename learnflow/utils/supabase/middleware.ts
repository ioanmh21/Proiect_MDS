import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const updateSession = async (request: NextRequest) => {
  console.log("Middleware running for path:", request.nextUrl.pathname);
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const userResponse = await supabase.auth.getUser();
  console.log("getUser response:", userResponse);
  const user = userResponse.data.user;

  // Protect /dashboard and all its subpaths
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!user) {
      // If no user is logged in, redirect to login
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // If user is logged in, check their role in the profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile in middleware:", profileError);
    }
    console.log("Fetched profile:", profile);

    const role = profile?.role?.toLowerCase();
    
    // Determine the correct dashboard path based on the role
    let correctDashboardPath = "/dashboard/elev"; // Default fallback to prevent infinite login loops if profile fetch fails
    
    if (role === "profesor" || role === "teacher") {
      correctDashboardPath = "/dashboard/profesor";
    } else if (role === "admin") {
      correctDashboardPath = "/dashboard/admin";
    }

    // If they are trying to access another role's dashboard or the root /dashboard,
    // redirect them to their specific dashboard
    if (
      request.nextUrl.pathname === "/dashboard" || 
      (!request.nextUrl.pathname.startsWith(correctDashboardPath))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = correctDashboardPath;
      return NextResponse.redirect(url);
    }
  }

  // Allow them to continue if they are on the correct path
  return supabaseResponse;
};
