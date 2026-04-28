import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { RevampSectionSnapshot } from "../../../api/revampApplicationApi";
import { AlboASection1 } from "./alboA/AlboASection1";
import { AlboASection2 } from "./alboA/AlboASection2";
import { AlboASection3A } from "./alboA/AlboASection3A";
import { AlboASection3B } from "./alboA/AlboASection3B";
import { AlboASection4 } from "./alboA/AlboASection4";
import { AlboASection5 } from "./alboA/AlboASection5";
import { AlboBSection1 } from "./alboB/AlboBSection1";
import { AlboBSection2 } from "./alboB/AlboBSection2";
import { AlboBSection3 } from "./alboB/AlboBSection3";
import { AlboBSection4 } from "./alboB/AlboBSection4";
import { AlboBSection5 } from "./alboB/AlboBSection5";

type SectionPayload = Record<string, unknown>;

function parsePayload(snap: RevampSectionSnapshot | undefined): SectionPayload | null {
  if (!snap?.payloadJson) return null;
  try {
    const parsed = JSON.parse(snap.payloadJson) as unknown;
    if (parsed && typeof parsed === "object") return parsed as SectionPayload;
  } catch {
    return null;
  }
  return null;
}

function findSection(sections: RevampSectionSnapshot[], ...keys: string[]): SectionPayload | null {
  for (const key of keys) {
    const snap = sections.find((s) => s.sectionKey === key);
    const payload = parsePayload(snap);
    if (payload) return payload;
  }
  return null;
}

interface ColEntry {
  key: string;
  node: ReactNode;
}

interface BalancedColumnsProps {
  entries: ColEntry[];
}

/** Renders entries in two columns balanced by actual rendered height.
 *  Uses a hidden measurement pass (useLayoutEffect) so no flicker occurs. */
function BalancedColumns({ entries }: BalancedColumnsProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<[ColEntry[], ColEntry[]] | null>(null);
  const [measuredKey, setMeasuredKey] = useState("");

  const currentKey = entries.map((e) => e.key).join(",");
  const needsMeasure = currentKey !== measuredKey;

  // Runs after every commit but exits early once measured.
  // useLayoutEffect fires before the browser paints, so the measurement
  // pass is never visible to the user.
  useLayoutEffect(() => {
    if (!needsMeasure || !measureRef.current) return;

    const cards = Array.from(measureRef.current.children) as HTMLElement[];
    const heights = cards.map((el) => el.getBoundingClientRect().height);

    // Greedy sequential bin-packing using real heights
    const left: ColEntry[] = [];
    const right: ColEntry[] = [];
    let wL = 0;
    let wR = 0;
    for (let i = 0; i < entries.length; i++) {
      const h = heights[i] ?? 0;
      if (wL <= wR) { left.push(entries[i]); wL += h; }
      else           { right.push(entries[i]); wR += h; }
    }

    setColumns([left, right]);
    setMeasuredKey(currentKey);
  });

  // Measurement pass — committed to DOM, measured, then immediately replaced.
  if (needsMeasure) {
    return (
      <div ref={measureRef} className="supplier-profile-measure">
        {entries.map((e) => <div key={e.key}>{e.node}</div>)}
      </div>
    );
  }

  const [left, right] = columns!;
  return (
    <div className="supplier-profile-sections">
      <div className="profile-col">
        {left.map((e) => <div key={e.key}>{e.node}</div>)}
      </div>
      <div className="profile-col">
        {right.map((e) => <div key={e.key}>{e.node}</div>)}
      </div>
    </div>
  );
}

interface Props {
  isAlboB: boolean;
  sections: RevampSectionSnapshot[];
}

export function SupplierProfileView({ isAlboB, sections }: Props) {
  if (sections.length === 0) {
    return <p className="profile-empty">Nessuna sezione compilata disponibile.</p>;
  }

  let entries: ColEntry[];

  if (isAlboB) {
    const s1 = findSection(sections, "S1");
    const s2 = findSection(sections, "S2");
    const s3 = findSection(sections, "S3");
    const s4 = findSection(sections, "S4");
    const s5 = findSection(sections, "S5");
    entries = [
      { key: "s1", node: <AlboBSection1 payload={s1} /> },
      { key: "s2", node: <AlboBSection2 payload={s2} /> },
      { key: "s3", node: <AlboBSection3 payload={s3} /> },
      { key: "s4", node: <AlboBSection4 payload={s4} /> },
      { key: "s5", node: <AlboBSection5 payload={s5} /> },
    ];
  } else {
    const s1  = findSection(sections, "S1");
    const s2  = findSection(sections, "S2");
    const s3a = findSection(sections, "S3A");
    const s3b = findSection(sections, "S3B");
    const s4  = findSection(sections, "S4");
    const s5  = findSection(sections, "S5");
    // S3A and S3B are mutually exclusive; always show whichever applies.
    // If neither has data yet, fall back to S3A as an empty placeholder.
    const s3Node = s3a
      ? <AlboASection3A payload={s3a} />
      : <AlboASection3B payload={s3b} />;
    const s3Key = s3a ? "s3a" : "s3b";
    entries = [
      { key: "s1",  node: <AlboASection1 payload={s1} /> },
      { key: "s2",  node: <AlboASection2 payload={s2} /> },
      { key: s3Key, node: s3Node },
      { key: "s4",  node: <AlboASection4 payload={s4} /> },
      { key: "s5",  node: <AlboASection5 payload={s5} /> },
    ];
  }

  return <BalancedColumns entries={entries} />;
}
