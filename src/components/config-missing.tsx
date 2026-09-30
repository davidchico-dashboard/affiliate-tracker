import { ShieldAlert } from "lucide-react";

/** Shown when the server-side Supabase env vars are missing. */
export function ConfigMissing({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5" aria-hidden />
          <h1 className="text-base font-semibold text-foreground">Configuration required</h1>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          Add the following server environment variables to your deployment:
        </p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li className="font-mono">SUPABASE_URL</li>
          <li className="font-mono">SUPABASE_ANON_KEY</li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          The anon key is public and safe in the browser — security is enforced by Row Level
          Security. Never expose the service-role key through a browser request or error message.
        </p>
      </div>
    </div>
  );
}
