import {
  displayCatalogItemType,
  normalizeCatalogItemType,
} from "@/lib/catalog-item-types";

function badgeTone(itemType: string) {
  const t = itemType.toLowerCase();
  if (t.includes("dog") && t.includes("dry")) {
    return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
  }
  if (t.includes("cat") && t.includes("dry")) {
    return "bg-violet-500/15 text-violet-200 ring-violet-500/30";
  }
  if (t.includes("wet") || t.includes("can") || t.includes("pouch")) {
    return "bg-sky-500/15 text-sky-200 ring-sky-500/30";
  }
  if (t.includes("treat")) {
    return "bg-orange-500/15 text-orange-200 ring-orange-500/30";
  }
  if (t.includes("litter")) {
    return "bg-stone-500/15 text-stone-200 ring-stone-500/30";
  }
  if (t.includes("medicine") || t.includes("vitamin")) {
    return "bg-rose-500/15 text-rose-200 ring-rose-500/30";
  }
  if (t.includes("toy")) {
    return "bg-teal-500/15 text-teal-200 ring-teal-500/30";
  }
  return "bg-zinc-500/15 text-zinc-700 ring-zinc-500/30";
}

export function ItemTypeBadge(props: {
  itemType: string | null | undefined;
  size?: "xs" | "sm";
  className?: string;
}) {
  const normalized = normalizeCatalogItemType(props.itemType);
  const label = displayCatalogItemType(normalized);
  const sizeClass =
    props.size === "xs"
      ? "px-1.5 py-0.5 text-[9px]"
      : "px-2 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md font-medium ring-1 ring-inset ${sizeClass} ${badgeTone(normalized)} ${props.className ?? ""}`}
    >
      {label}
    </span>
  );
}
