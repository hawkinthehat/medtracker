/** Populated from the root layout (server) so the browser bundle can still create a Supabase client when NEXT_PUBLIC_* was not present at build time. */

declare global {
  interface Window {
    __TIAKI_SUPABASE_PUBLIC__?: {
      url?: string;
      anonKey?: string;
    };
  }
}

export {};
