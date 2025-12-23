import { createClient } from "@supabase/supabase-js";
import { secret } from "encore.dev/config";

export const supabaseUrl = secret("SUPABASE_URL");
const supabaseAnonRoleKey = secret("SUPABASE_ANON_KEY");
const supabaseServiceRoleKey = secret("SUPABASE_SERVICE_ROLE_KEY");
// Initialize the Supabase client for shared use across services.
export const supabase = createClient(supabaseUrl(), supabaseAnonRoleKey()); 
export const supabaseAdmin = createClient(supabaseUrl(), supabaseServiceRoleKey()); 

const ankitoonSupabaseUrl = secret("ANKITOON_SUPABASE_URL");
const ankitoonSupabasePublishableKey = secret("ANKITOON_SUPABASE_PUBLISHABLE_KEY");

export const ankitoonSupabase = createClient(ankitoonSupabaseUrl(), ankitoonSupabasePublishableKey());