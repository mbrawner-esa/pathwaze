/**
 * Md — renders the only markup the What's New copy uses: **bold** runs.
 *
 * The release note in src/lib/whats-new.ts is plain strings so it stays easy to
 * rewrite each release. This keeps that promise without pulling in a markdown
 * dependency for one inline token.
 */
export function Md({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((part, i) =>
        // Odd indices are the captured groups — i.e. what was inside the **…**.
        i % 2 === 1 ? <strong key={i} className="font-bold text-[#080707]">{part}</strong> : part
      )}
    </>
  )
}
