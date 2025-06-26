import { createClient } from "@supabase/supabase-js";
import { secret } from "encore.dev/config";

export const supabaseUrl = secret("SUPABASE_URL");
const supabaseServiceRoleKey = secret("SUPABASE_ANON_KEY");

// Initialize the Supabase client for shared use across services.
export const supabase = createClient(supabaseUrl(), supabaseServiceRoleKey()); 