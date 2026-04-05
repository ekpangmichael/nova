"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";

const PER_PAGE_OPTIONS = [6, 12, 24, 48];

const buildVisiblePages = (currentPage: number, totalPages: number, maxVisible = 5) => {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const halfWindow = Math.floor(maxVisible / 2);
  let start = Math.max(1, currentPage - halfWindow);
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export function Pagination({
  total,
  pageSize = 12,
  currentPage = 1,
  pages,
  queryMode = "static",
}: {
  total: number;
  pageSize?: number;
  currentPage?: number;
  pages?: number;
  queryMode?: "static" | "url";
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, pages ?? Math.ceil(total / pageSize));
  const visiblePages = useMemo(
    () => buildVisiblePages(currentPage, totalPages),
    [currentPage, totalPages]
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(currentPage * pageSize, total);

  const navigate = (nextPage: number, nextPageSize = pageSize) => {
    if (queryMode !== "url") {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="mt-8 flex items-center justify-between anim-4">
      <p className="font-mono text-[11px] text-on-surface-variant/30">
        {start}–{end} of {total}
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => navigate(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant/25 transition-colors hover:bg-surface-container-high/40 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Icon name="chevron_left" size={16} />
        </button>

        {visiblePages.map((page) => (
          <button
            key={page}
            onClick={() => navigate(page)}
            className={
              page === currentPage
                ? "flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/15 font-mono text-[12px] font-semibold text-secondary"
                : "flex h-8 w-8 items-center justify-center rounded-lg font-mono text-[12px] text-on-surface-variant/30 transition-colors hover:bg-surface-container-high/40 hover:text-on-surface-variant/60"
            }
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => navigate(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant/40 transition-colors hover:bg-surface-container-high/40 hover:text-on-surface-variant/70 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Icon name="chevron_right" size={16} />
        </button>
      </div>

      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-on-surface-variant/25">Per page</span>
          <button
            onClick={() => setOpen((prev) => !prev)}
            className="flex items-center gap-1 rounded-lg bg-surface-container-high/30 px-2.5 py-1 font-mono text-[11px] text-on-surface-variant/50 transition-colors hover:bg-surface-container-high/50"
          >
            {pageSize}
            <Icon
              name="expand_more"
              size={14}
              className={`text-on-surface-variant/30 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {open && (
          <div className="absolute bottom-full right-0 mb-2 overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container/95 shadow-[0_-8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <div className="p-1">
              {PER_PAGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    navigate(1, option);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-6 rounded-lg px-3 py-1.5 font-mono text-[12px] transition-colors ${
                    option === pageSize
                      ? "bg-secondary/14 text-secondary"
                      : "text-on-surface-variant/50 hover:bg-surface-container-high/60 hover:text-on-surface-variant/80"
                  }`}
                >
                  {option}
                  {option === pageSize && <Icon name="check" size={14} className="text-secondary" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
