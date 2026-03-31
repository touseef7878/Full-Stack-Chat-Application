import { createClient } from '@supabase/supabase-js';

// Ensure these environment variables are set in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is not set in environment variables.");
  // You might want to throw an error or handle this more gracefully in a production app
}

// PERFORMANCE OPTIMIZATIONS - WhatsApp-level configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // More secure and faster
  },
  realtime: {
    params: {
      eventsPerSecond: 100, // Increased for high-frequency updates
    },
  },
  global: {
    headers: {
      'x-client-info': 'prochat-web',
    },
  },
});

// Connection pool optimization
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Enhanced error handling with retry logic
export const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && (error?.code === 'PGRST301' || error?.message?.includes('timeout'))) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return executeWithRetry(operation, retries - 1);
    }
    throw error;
  }
};

// Optimized query builder with automatic retry
export const createOptimizedQuery = (table: string) => {
  return {
    select: (columns: string) => executeWithRetry(() => supabase.from(table).select(columns)),
    insert: (data: any) => executeWithRetry(() => supabase.from(table).insert(data)),
    update: (data: any) => executeWithRetry(() => supabase.from(table).update(data)),
    delete: () => executeWithRetry(() => supabase.from(table).delete()),
    rpc: (fn: string, params: any) => executeWithRetry(() => supabase.rpc(fn, params)),
  };
};