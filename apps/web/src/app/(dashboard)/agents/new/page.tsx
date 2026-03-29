"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

const models = [
  "Claude 3.5 Sonnet",
  "Claude 3 Opus",
  "Claude 3 Haiku",
  "GPT-4o",
  "Llama 3 70B (Local)",
];

const agentIcons = [
  "smart_toy", "memory", "cloud_sync", "model_training", "security",
  "psychology", "hub", "terminal", "code", "api",
  "language", "visibility", "rocket_launch", "neurology", "precision_manufacturing",
  "auto_fix_high", "monitoring", "analytics", "data_object", "dns",
  "bolt", "shield", "explore", "face",
];

const thinkingLevels = ["Low", "Normal", "Medium", "High"];

export default function NewAgentPage() {
  const router = useRouter();
  const [thinkingLevel, setThinkingLevel] = useState("Normal");
  const [selectedIcon, setSelectedIcon] = useState("smart_toy");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setShowIconPicker(false);
      }
    }
    if (showIconPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showIconPicker]);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back */}
      <Link
        href="/agents"
        className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 text-sm mb-8 anim-1"
      >
        <Icon name="arrow_back" size={16} />
        Agent Fleet
      </Link>

      {/* Header */}
      <header className="mb-16 anim-1">
        <h1 className="text-3xl font-thin text-on-surface tracking-tight mb-2">
          Onboard New Agent
        </h1>
        <p className="text-on-surface-variant font-light max-w-lg">
          Define the parameters, cognitive boundaries, and operational
          permissions for the new autonomous node.
        </p>
      </header>

      <form
        className="space-y-24"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/agents");
        }}
      >
        {/* 01 Identity */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 anim-2">
          <div className="md:col-span-4">
            <h2 className="text-sm font-medium text-secondary tracking-widest uppercase mb-2">
              01 Identity
            </h2>
            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
              Establish the public face and designation of the agent within the
              system network.
            </p>
          </div>
          <div className="md:col-span-8 space-y-8">
            <div className="flex items-center gap-8">
              {/* Icon picker */}
              <div className="relative shrink-0" ref={iconPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowIconPicker((v) => !v)}
                  className="w-24 h-24 bg-surface-container-low flex items-center justify-center ghost hover:border-secondary/30 transition-all cursor-pointer group"
                >
                  <Icon
                    name={selectedIcon}
                    size={36}
                    className="text-secondary/70 group-hover:text-secondary transition-colors"
                  />
                </button>
                <div className="absolute -bottom-1 -right-1 bg-secondary text-white w-6 h-6 rounded-full flex items-center justify-center pointer-events-none">
                  <Icon name="edit" size={12} />
                </div>

                {showIconPicker && (
                  <div className="absolute top-full left-0 mt-2 z-50 bg-surface-container-lowest ghost p-3 w-[280px] shadow-xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-3">
                      Select Icon
                    </p>
                    <div className="grid grid-cols-6 gap-1">
                      {agentIcons.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => {
                            setSelectedIcon(icon);
                            setShowIconPicker(false);
                          }}
                          className={`w-10 h-10 flex items-center justify-center rounded-sm transition-all ${
                            selectedIcon === icon
                              ? "bg-secondary/15 text-secondary"
                              : "text-on-surface-variant/60 hover:bg-surface-container-high hover:text-on-surface"
                          }`}
                        >
                          <Icon name={icon} size={20} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    className="w-full bg-transparent border-none border-b border-outline-variant/30 py-2 text-on-surface text-lg font-light placeholder:text-on-surface-variant/20 focus:ring-0 focus:outline-none focus:border-secondary transition-colors"
                    style={{ borderBottom: "1px solid rgba(72,72,75,0.3)" }}
                    onFocus={(e) => (e.target.style.borderBottom = "1px solid #7b99ff")}
                    onBlur={(e) => (e.target.style.borderBottom = "1px solid rgba(72,72,75,0.3)")}
                    placeholder="e.g. Architect-01"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                    Assigned Role
                  </label>
                  <input
                    type="text"
                    className="w-full bg-transparent border-none py-2 text-on-surface font-light placeholder:text-on-surface-variant/20 focus:ring-0 focus:outline-none"
                    style={{ borderBottom: "1px solid rgba(72,72,75,0.3)" }}
                    onFocus={(e) => (e.target.style.borderBottom = "1px solid #7b99ff")}
                    onBlur={(e) => (e.target.style.borderBottom = "1px solid rgba(72,72,75,0.3)")}
                    placeholder="e.g. Lead Technical Researcher"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 Intelligence */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 anim-2">
          <div className="md:col-span-4">
            <h2 className="text-sm font-medium text-secondary tracking-widest uppercase mb-2">
              02 Intelligence
            </h2>
            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
              Configure the cognitive engine and behavioral logic that drives
              the agent&apos;s reasoning.
            </p>
          </div>
          <div className="md:col-span-8 space-y-10">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                System Instructions
              </label>
              <textarea
                className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[120px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
                placeholder="Define the core logic, behavioral constraints, and personality of the agent..."
                rows={5}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  Model Selection
                </label>
                <div className="relative">
                  <select className="w-full appearance-none bg-surface-container-low border-none px-4 py-3 text-on-surface text-sm focus:ring-0 focus:outline-none">
                    {models.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <Icon
                    name="expand_more"
                    size={18}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                    Thinking Level
                  </label>
                  <span className="text-xs text-secondary font-mono">
                    {thinkingLevel}
                  </span>
                </div>
                <div className="flex gap-2">
                  {thinkingLevels.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setThinkingLevel(level)}
                      className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-medium transition-all ${
                        thinkingLevel === level
                          ? "bg-secondary/15 text-secondary"
                          : "bg-surface-container-low text-on-surface-variant/40 hover:text-on-surface-variant"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Action Footer */}
        <div className="pt-12 ghost-t flex flex-col md:flex-row items-center justify-between gap-6 anim-4">
          <p className="text-[10px] text-on-surface-variant/40 max-w-sm">
            By finalizing onboarding, you confirm this agent adheres to the
            Obsidian Protocol safety standards and alignment requirements.
          </p>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link
              href="/agents"
              className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-all text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium bg-primary text-on-primary hover:opacity-80 transition-all active:scale-[0.98]"
            >
              Deploy Agent
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
