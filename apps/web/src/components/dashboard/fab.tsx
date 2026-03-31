"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export function FAB() {
  return (
    <Link
      href="/tasks/new"
      className="fab-btn fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3.5 rounded-xl z-50 shadow-2xl text-white text-sm font-semibold tracking-tight transition-all hover:opacity-90 active:scale-[0.97]"
      style={{
        background: "linear-gradient(to bottom, #7b99ff, #6584e8)",
      }}
    >
      <Icon name="add" size={20} className="text-white" />
      New Task
    </Link>
  );
}
