import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Factory to create a Supabase client authenticated as the Clerk user
export const createClerkSupabaseClient = (clerkToken: string) => {
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            // Send the Clerk JWT to Supabase for all requests
            headers: { Authorization: `Bearer ${clerkToken}` },
        },
    });
};

// Export a base client for public (unauthenticated) queries if needed
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
