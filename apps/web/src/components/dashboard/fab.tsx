"use client";

import { Icon } from "@/components/ui/icon";

export function FAB() {
  return (
    <button
      className="fab-btn fixed bottom-8 right-8 w-[52px] h-[52px] flex items-center justify-center rounded-xl z-50 shadow-2xl"
      style={{
        background: "linear-gradient(to bottom, #7b99ff, #6584e8)",
      }}
      onClick={() => {}}
    >
      <Icon name="add" size={24} className="text-white" />
    </button>
  );
}
