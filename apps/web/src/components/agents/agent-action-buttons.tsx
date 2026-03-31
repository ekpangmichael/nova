"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import { ApiError, deleteAgent } from "@/lib/api";

export function AgentActionButtons({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  async function handleDelete() {
    if (confirmInput !== agentName) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteAgent(agentId);
      window.location.assign("/agents");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to delete the agent right now."
      );
      setIsDeleting(false);
    }
  }

  const modal = showDeleteModal ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface/80 backdrop-blur-sm"
        onClick={() => {
          if (!isDeleting) setShowDeleteModal(false);
        }}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-surface-container ghost shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-error/12">
              <Icon name="delete_forever" size={18} className="text-error" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Delete Agent</h2>
              <p className="text-[11px] text-on-surface-variant/60 mt-0.5">
                This action cannot be undone
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isDeleting) {
                setShowDeleteModal(false);
                setConfirmInput("");
              }
            }}
            disabled={isDeleting}
            className="text-on-surface-variant/40 hover:text-on-surface-variant transition-colors disabled:opacity-30"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Deleting{" "}
            <span className="font-semibold text-on-surface">{agentName}</span>{" "}
            will permanently remove this agent, its configuration, run history,
            and all project assignments.
          </p>

          <div className="bg-error/6 border border-error/20 rounded-sm px-4 py-3 flex items-start gap-3">
            <Icon name="warning" size={16} className="text-error shrink-0 mt-0.5" />
            <p className="text-xs text-error/80 leading-relaxed">
              Project links will be removed, but tasks assigned to this agent
              must be reassigned or deleted first. Any active runs will be
              terminated immediately.
            </p>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-2 font-medium">
              Type the agent name to confirm
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(event) => setConfirmInput(event.target.value)}
              disabled={isDeleting}
              placeholder={agentName}
              className="w-full bg-surface-container-low rounded-sm ghost px-4 py-3 text-sm text-on-surface font-mono focus:border-error/40 focus:ring-0 focus:outline-none transition-all placeholder:text-on-surface-variant/25 disabled:opacity-50"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {errorMessage ? (
            <div className="border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {errorMessage}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-6">
          <button
            type="button"
            onClick={() => {
              setShowDeleteModal(false);
              setConfirmInput("");
            }}
            disabled={isDeleting}
            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors font-medium disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={confirmInput !== agentName || isDeleting}
            className="flex items-center gap-2 bg-error text-on-error px-5 py-2.5 rounded-sm text-sm font-semibold transition-all active:scale-[0.98] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Icon name="sync" size={14} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Icon name="delete_forever" size={14} />
                Delete Agent
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="flex items-center gap-2">
        <Link
          href={`/agents/${agentId}/edit`}
          className="ghost flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all"
        >
          <Icon name="edit" size={14} />
          Edit
        </Link>
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setConfirmInput("");
            setShowDeleteModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-medium text-error/70 hover:text-error hover:bg-error/8 transition-all"
        >
          <Icon name="delete" size={14} />
          Delete
        </button>
      </div>

      {isMounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
