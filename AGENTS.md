<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (Lantern)

- Chat data access goes through the browser Supabase client with RLS; membership checks use the `is_member` security-definer function to avoid recursive policies.
- Creating DMs/groups, adding members, leaving and listing conversations go through security-definer RPCs (`get_or_create_dm`, `create_group`, `add_group_members`, `leave_conversation`, `list_my_conversations`) because members rows have no client INSERT policy.
- DMs are de-duplicated by `conversations.dm_key` (sorted user-id pair) so two friends always share one thread.
- Chat photos live in the private `chat-photos` bucket under `<conversation_id>/<file>`; storage policies key off that first folder, and the UI reads them with signed URLs.
- One realtime channel lives in the `/chats` layout and patches the React Query cache; don't add per-thread subscriptions.
- Theme is a `dark` class on `<html>`, set before paint by `themeBootScript` in `__root.tsx` and read via `useTheme()` (useSyncExternalStore) so every toggle stays in sync.
- Invite links are `/add/<username>`; post-sign-in redirects must pass `safeRedirect` (same-origin relative paths only).
