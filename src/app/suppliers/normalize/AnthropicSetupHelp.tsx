export function FreeParseTips() {
  return (
    <div className="space-y-2 text-xs leading-relaxed text-zinc-400">
      <p className="font-medium text-emerald-100">Free parsing (no API key needed)</p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          <strong className="text-zinc-200">Paste text</strong> — copy product lines from
          Messenger, Viber, or Google Sheets (include names + wholesale prices).
        </li>
        <li>
          <strong className="text-zinc-200">Upload PDF</strong> — text-based supplier PDFs
          work automatically.
        </li>
        <li>
          <strong className="text-zinc-200">Photos (PNG/JPG)</strong> — OCR runs in your
          browser (works on Vercel free tier). Use clear, straight photos. Claude AI is
          optional for messy images.
        </li>
      </ul>
      <p className="text-[10px] text-zinc-500">
        Example line:{" "}
        <code className="rounded bg-black/40 px-1">
          Aozi Gold Adult 20kg 2975
        </code>{" "}
        or paste a tab-separated sheet with columns like item, size, wholesale.
      </p>
    </div>
  );
}

export function AnthropicSetupHelp(props: { compact?: boolean }) {
  if (props.compact) {
    return (
      <p className="text-xs leading-relaxed text-zinc-400">
        Optional: add{" "}
        <code className="rounded bg-black/40 px-1 py-0.5 text-[10px] text-zinc-200">
          ANTHROPIC_API_KEY
        </code>{" "}
        for photo/PDF AI scanning. Text and PDF parsing works without it.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-xs leading-relaxed text-zinc-400">
      <FreeParseTips />
      <div className="border-t border-white/10 pt-3">
        <p className="font-medium text-zinc-300">Optional: AI for photos</p>
        <p className="mt-1">
          If you later want to scan pricelist <em>photos</em>, add a Claude key from{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-200 underline"
          >
            console.anthropic.com
          </a>{" "}
          to <code className="rounded bg-black/40 px-1">.env.local</code> or Vercel env vars.
        </p>
      </div>
    </div>
  );
}
