"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";

type Comment = {
  author: string;
  isAI: boolean;
  timeAgo: string;
  message: string;
};

const mockComments: Comment[] = [
  {
    author: "System Arch",
    isAI: false,
    timeAgo: "2 hours ago",
    message:
      "Agent reported a hallucination on the financial charts. I've re-uploaded the verified CSV in the attachments.",
  },
  {
    author: "Content Writer (AI)",
    isAI: true,
    timeAgo: "1 hour ago",
    message:
      "Refined context detected. Adjusting post outline to incorporate new retention data. Expected completion in 45 minutes.",
  },
];

export function CommentThread() {
  const [comments, setComments] = useState(mockComments);
  const [input, setInput] = useState("");

  function handleSubmit() {
    if (!input.trim()) return;
    setComments((prev) => [
      ...prev,
      {
        author: "admin_root",
        isAI: false,
        timeAgo: "Just now",
        message: input.trim(),
      },
    ]);
    setInput("");
  }

  return (
    <div className="space-y-6 pt-8">
      <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">
        Comment Thread
      </h3>

      <div className="space-y-5">
        {comments.map((comment, i) => (
          <div key={i} className="flex gap-4">
            {/* Avatar */}
            <div
              className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center ${
                comment.isAI
                  ? "bg-secondary text-white"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              <Icon
                name={comment.isAI ? "smart_toy" : "person"}
                size={20}
                filled={comment.isAI}
              />
            </div>

            {/* Comment body */}
            <div className="flex-1 ghost rounded-sm p-4">
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-sm font-bold ${
                    comment.isAI ? "text-secondary" : "text-on-surface"
                  }`}
                >
                  {comment.author}
                </span>
                <span className="font-mono text-[10px] text-on-surface-variant/40">
                  {comment.timeAgo}
                </span>
              </div>
              <p
                className={`text-sm leading-relaxed ${
                  comment.isAI
                    ? "text-on-surface-variant/70 italic"
                    : "text-on-surface-variant"
                }`}
              >
                {comment.message}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-3 bg-surface-container-high/50 ghost rounded-sm p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Write a comment or instruction..."
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder:text-on-surface-variant/30 p-0"
        />
        <button
          onClick={handleSubmit}
          className="text-on-surface-variant/40 hover:text-on-surface transition-colors"
        >
          <Icon name="send" size={20} />
        </button>
      </div>
    </div>
  );
}
