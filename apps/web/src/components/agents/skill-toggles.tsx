"use client";

import { useState } from "react";
import type { AgentSkill } from "@/types";

export function SkillToggles({ initialSkills }: { initialSkills: AgentSkill[] }) {
  const [skills, setSkills] = useState(initialSkills);

  function toggle(name: string) {
    setSkills((prev) =>
      prev.map((s) =>
        s.name === name ? { ...s, enabled: !s.enabled } : s
      )
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xs uppercase tracking-[0.3em] text-on-surface-variant border-l-2 border-secondary pl-4">
        Operational Skills
      </h3>
      <div className="space-y-4">
        {skills.map((skill) => (
          <div
            key={skill.name}
            className="flex justify-between items-center py-2"
          >
            <span className="text-on-surface font-light">{skill.name}</span>
            <button
              onClick={() => toggle(skill.name)}
              className={`w-10 h-5 rounded-full relative transition-colors ${
                skill.enabled
                  ? "bg-secondary-container"
                  : "bg-surface-container-high ghost"
              }`}
            >
              <div
                className={`absolute top-1 w-3 h-3 rounded-full transition-all ${
                  skill.enabled
                    ? "right-1 bg-secondary"
                    : "left-1 bg-outline"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
