import { APIError, Header } from "encore.dev/api";
import { createClient } from "@supabase/supabase-js";
import { secret } from "encore.dev/config";

const supabaseUrl = secret("SUPABASE_URL");
const supabaseServiceRoleKey = secret("SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl(), supabaseServiceRoleKey());

export interface AuthParams {
    authorization: Header<"Authorization">;
}

export interface AuthData {
    userId: string;
    email?: string;
}

export async function authHandler({ authorization }: AuthParams): Promise<AuthData> {
    if (!authorization || !authorization.startsWith("Bearer ")) {
        throw APIError.unauthenticated("Missing or invalid Authorization header");
    }
    const token = authorization.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) {
        throw APIError.unauthenticated(`Invalid token: ${error.message}`);
    }
    if (!user) {
        throw APIError.unauthenticated("User not found");
    }
    return { userId: user.id, email: user.email };
} 