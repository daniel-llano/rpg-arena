import type { LeaderboardEntry } from "@/api/types";

export function Leaderboard({ rows, currentRunId }: { rows: LeaderboardEntry[] | null; currentRunId: string | null }) {
  return (
    <section className="panel" aria-labelledby="board-title">
      <h2 id="board-title">Leaderboard</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Hero</th>
              <th>Class</th>
              <th className="num">Level</th>
              <th className="num">Wins</th>
              <th className="num">Gold</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="leaderboard">
            {rows === null && (
              <tr>
                <td colSpan={7} className="muted">
                  Loading…
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No heroes yet. Be the first.
                </td>
              </tr>
            )}
            {rows?.map((r, i) => (
              <tr key={r.id} className={r.id === currentRunId ? "current" : undefined}>
                <td>{i + 1}</td>
                <td>
                  <a href={`?watch=${r.id}`}>{r.heroName}</a>
                </td>
                <td>{r.heroClass}</td>
                <td className="num">{r.level}</td>
                <td className="num">{r.wins}</td>
                <td className="num">{r.gold}</td>
                <td className="muted small">{r.status === "Defeated" ? "fallen" : "fighting"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
