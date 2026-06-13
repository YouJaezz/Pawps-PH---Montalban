export function FreeParseTips() {
  return (
    <div className="space-y-2 text-xs leading-relaxed text-zinc-600">
      <p className="font-medium text-brand-cyan/90">Free parsing (no API key needed)</p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          <strong className="text-zinc-800">Paste text</strong> — copy product lines from
          Messenger, Viber, or Google Sheets (include names + wholesale prices).
        </li>
        <li>
          <strong className="text-zinc-800">Upload PDF</strong> — text-based supplier PDFs
          work automatically.
        </li>
        <li>
          <strong className="text-zinc-800">Photos (PNG/JPG)</strong> — OCR runs in your
          browser, then results are matched to your catalog. For messy photos, use{" "}
          <strong className="text-zinc-800">Smart scan</strong> (Claude + catalog).
        </li>
      </ul>
      <p className="text-[10px] text-zinc-600">
        Example line:{" "}
        <code className="rounded bg-white border border-zinc-300 px-1">
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
      <p className="text-xs leading-relaxed text-zinc-600">
        Optional: add{" "}
        <code className="rounded bg-white border border-zinc-300 px-1 py-0.5 text-[10px] text-zinc-800">
          ANTHROPIC_API_KEY
        </code>{" "}
        for photo/PDF AI scanning. Text and PDF parsing works without it.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-xs leading-relaxed text-zinc-600">
      <FreeParseTips />
      <div className="border-t border-zinc-200 pt-3">
        <p className="font-medium text-zinc-700">Smart scan (recommended for PDF/photos)</p>
        <p className="mt-1">
          Add a Claude key from{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-200 underline"
          >
            console.anthropic.com
          </a>{" "}
          to <code className="rounded bg-white border border-zinc-300 px-1">.env.local</code> or Vercel as{" "}
          <code className="rounded bg-white border border-zinc-300 px-1">ANTHROPIC_API_KEY</code>.
          Smart scan reads the document and sorts rows using your shop&apos;s known
          brands, items, flavors, and pack sizes — not just what the PDF OCR guessed.
        </p>
      </div>
    </div>
  );
}
