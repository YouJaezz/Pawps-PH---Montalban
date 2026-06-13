"use client";

import { useState } from "react";

import { updateSupplier } from "@/app/suppliers/actions";
import { EditModal, modalFieldClass } from "@/components/EditModal";

export function SupplierEditButton(props: {
  supplierId: number;
  name: string;
  contact: string | null;
  location: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 text-[10px] text-brand-blue/90 hover:text-brand-blue"
      >
        Edit
      </button>
      <EditModal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit supplier"
        subtitle={props.name}
      >
        <form action={updateSupplier} className="space-y-2">
          <input type="hidden" name="supplierId" value={props.supplierId} />
          <label className="block space-y-0.5">
            <span className="text-[11px] text-zinc-400">Name</span>
            <input
              name="name"
              required
              defaultValue={props.name}
              className={modalFieldClass}
            />
          </label>
          <label className="block space-y-0.5">
            <span className="text-[11px] text-zinc-400">Contact</span>
            <input
              name="contact"
              defaultValue={props.contact ?? ""}
              className={modalFieldClass}
            />
          </label>
          <label className="block space-y-0.5">
            <span className="text-[11px] text-zinc-400">City</span>
            <input
              name="location"
              defaultValue={props.location ?? ""}
              className={modalFieldClass}
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900"
          >
            Save supplier
          </button>
        </form>
      </EditModal>
    </>
  );
}
