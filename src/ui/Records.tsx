import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getPage } from "../data/api";
import type { Options } from "../game/config";
export function Records({
  kind,
  options,
}: {
  kind: "ranking" | "history";
  options: Options;
}) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [kind, page, options],
    queryFn: ({ signal }) => getPage(kind, page, options, signal),
    refetchOnMount: "always",
  });
  return (
    <section className="records">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {kind === "ranking" ? "THE CAPTAINS’ TABLE" : "YOUR SHIP’S LOG"}
          </span>
          <h2>
            {kind === "ranking"
              ? "A place in the legends."
              : "Every voyage tells a story."}
          </h2>
        </div>
        <span className="tag">
          {options.duration}s · {options.spawnInterval}s spawns
        </span>
      </div>
      {query.isPending ? (
        <p role="status">Fetching the ship’s log…</p>
      ) : query.isError ? (
        <div role="alert">
          <p>
            The harbor service is unavailable. Your next voyage can still begin.
          </p>
          <button onClick={() => void query.refetch()}>Try again</button>
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{kind === "ranking" ? "Rank" : "Date"}</th>
                  <th>Captain</th>
                  <th>Score</th>
                  <th>Duration</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((m, i) => (
                  <tr key={m.id}>
                    <td>
                      {kind === "ranking"
                        ? String((page - 1) * 5 + i + 1).padStart(2, "0")
                        : new Date(m.date).toLocaleDateString("en-GB")}
                    </td>
                    <td>{m.playerName}</td>
                    <td>{m.score}</td>
                    <td>{Math.round(m.duration)}s</td>
                    <td>{m.reason === "time" ? "Survived" : "Sunk"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.data.items.length === 0 && (
            <p className="empty">
              No voyages here yet. Set sail and write the first entry.
            </p>
          )}
          <div className="pagination">
            <span>
              {query.data.total} voyages {query.isFetching ? "· Updating…" : ""}
            </span>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {query.data.pages}
            </span>
            <button
              disabled={page >= query.data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
