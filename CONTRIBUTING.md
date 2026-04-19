# Contributing

Follow these repo conventions for downstream prompts and feature work:

- Use `.jsx` and `.js` only. Do not add TypeScript.
- Do not install or use `shadcn/ui`. Match the existing hand-rolled UI style with Tailwind classes and inline styles.
- Import Supabase from `src/lib/supabase.js`. Do not recreate the client.
- Read `profile?.role` from `ProfileContext` and use the helpers in `src/lib/roles.js` for role checks. Never query the database for role during render.
- Data fetching should use raw `useEffect` plus async functions, with a `cancelled` flag to prevent `setState` after unmount.
- Loading states should use simple skeleton divs with Tailwind classes such as `animate-pulse` and `bg-slate-200`.
- Errors should default to inline messages. There is no shared toast pattern in the repo today; feature branches can add one sparingly if the UX needs it.
- Respect the existing color tokens: sidebar `#0f172a`, primary `#2563eb`, background `#f1f5f9`, text-primary `#0f172a`, text-secondary `#64748b`.
- Current role set: `rep`, `manager`, `admin`, `owner`.
- New tables used by this wave: `messages`, `notifications`, `failed_deliveries`.
- Lead stage values: `new`, `contacted`, `warm`, `hot`, `closed`, `unsubscribed`.
- Construct lead names as `first_name + ' ' + last_name`.
