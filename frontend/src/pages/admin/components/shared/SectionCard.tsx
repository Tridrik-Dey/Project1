import type { ReactNode } from "react";

interface SectionCardProps {
  icon: ReactNode;
  title: string;
  accent?: "blue" | "green" | "teal" | "orange" | "purple";
  children: ReactNode;
}

export function SectionCard({ icon, title, accent = "blue", children }: SectionCardProps) {
  return (
    <div className={`panel profile-section-card accent-${accent}`}>
      <div className="profile-section-header">
        <span className="profile-section-icon">{icon}</span>
        <h4 className="profile-section-title">{title}</h4>
      </div>
      <div className="profile-section-body">{children}</div>
    </div>
  );
}

export function ProfileSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="profile-subsection">
      <p className="profile-subsection-title">{title}</p>
      {children}
    </div>
  );
}
