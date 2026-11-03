import { useEffect, useRef } from "react";

export function BattleLog({ lines }: { lines: string[] }) {
  const list = useRef<HTMLOListElement>(null);
  const shown = lines.slice(-20);

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [lines]);

  return (
    <ol id="log" ref={list} className="panel log" aria-live="polite" aria-label="Battle log">
      {shown.map((line, i) => (
        <li key={`${lines.length - shown.length + i}:${line}`} className={i === shown.length - 1 ? "latest" : undefined}>
          {line}
        </li>
      ))}
    </ol>
  );
}
