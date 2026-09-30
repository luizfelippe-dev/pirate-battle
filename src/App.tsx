import { useCallback, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Combat } from "./ui/Combat";
import { Records } from "./ui/Records";
import {
  loadOptions,
  read,
  save,
  pending,
  enqueue,
  acknowledge,
  type Match,
} from "./data/storage";
import { validOptions } from "./game/config";
import { postMatch, queryClient } from "./data/api";
import { scenarios, resetNetwork, type Scenario } from "./data/mocks";
import { assetUrl } from "./paths";
export function App() {
  const [options, setOptions] = useState(loadOptions),
    [screen, setScreen] = useState<"menu" | "game" | "result">("menu"),
    [tab, setTab] = useState<"overview" | "ranking" | "history">("overview"),
    [last, setLast] = useState(() => read<Match | null>("last", null)),
    [queue, setQueue] = useState(pending),
    [sound, setSound] = useState(() => read("sound", false));
  const [scenario, setScenario] = useState(() =>
      read<Scenario>("scenario", "success"),
    ),
    [formError, setFormError] = useState("");
  const optionsDialog = useRef<HTMLDialogElement>(null),
    optionsButton = useRef<HTMLButtonElement>(null);
  const submission = useMutation({
    mutationFn: postMatch,
    onSuccess: (match) => {
      acknowledge(match.id);
      setQueue(pending());
      void queryClient.invalidateQueries({ queryKey: ["ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
  const finish = useCallback(
    (match: Match) => {
      enqueue(match);
      setQueue(pending());
      setLast(match);
      setScreen("result");
      submission.mutate(match);
    },
    [submission.mutate],
  );
  const start = () => setScreen("game");
  if (screen === "game")
    return (
      <Combat
        options={options}
        onEnd={finish}
        onExit={() => setScreen("menu")}
        sound={sound}
      />
    );
  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setScreen("menu");
          }}
        >
          ✦{" "}
          <span>
            PIRATE BATTLE<small>THE BROKEN COMPASS</small>
          </span>
        </a>
        <div className="header-right">
          <span className="edition">A NAVAL SURVIVAL GAME</span>
          <button
            className="sound"
            aria-pressed={sound}
            onClick={() => {
              save("sound", !sound);
              setSound(!sound);
            }}
          >
            Sound {sound ? "on" : "off"}
          </button>
        </div>
      </header>
      {screen === "result" && last ? (
        <main className="result">
          <span className="eyebrow">VOYAGE COMPLETE</span>
          <h1>
            {last.reason === "time"
              ? "You weathered the storm."
              : "The sea keeps its secrets."}
          </h1>
          <p>
            {last.reason === "time"
              ? "Your flag still flies. The archipelago remembers."
              : "A captain’s story never ends with one voyage."}
          </p>
          <div className="result-score">
            <span>{last.score.toString().padStart(2, "0")}</span>
            <span>ENEMY SHIPS SUNK</span>
          </div>
          <div className="result-details">
            <span>{Math.round(last.duration)} seconds at sea</span>
            <span>
              {last.reason === "time" ? "Time completed" : "Your ship was sunk"}
            </span>
          </div>
          <p role="status">
            {queue.some((m) => m.id === last.id)
              ? submission.isPending
                ? "Recording your voyage…"
                : "Saved on this device. Harbor registration pending."
              : "Voyage recorded in ranking and history."}
          </p>
          <div className="actions">
            <button className="primary" onClick={start}>
              Play Again →
            </button>
            <button onClick={() => setScreen("menu")}>Main Menu</button>
          </div>
        </main>
      ) : (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="live-dot" /> THE SHATTERED ISLES · 1718
              </div>
              <h1>
                Calm seas.
                <br />
                <em>Bad company.</em>
              </h1>
              <p>
                One ship. Unfriendly waters. Navigate the islands, line up your
                cannons, and make it back with a story worth telling.
              </p>
              <div className="actions">
                <button className="primary" onClick={start} aria-label="Play">
                  Play <span aria-hidden="true">↗</span>
                </button>
                <button
                  ref={optionsButton}
                  onClick={() => {
                    setFormError("");
                    optionsDialog.current?.showModal();
                  }}
                >
                  Options <span>⚙</span>
                </button>
              </div>
              <div className="voyage-meta">
                <span>
                  <b>{options.duration} SEC</b> PER VOYAGE
                </span>
                <span>
                  <b>3 WEAPONS</b> ONE CAPTAIN
                </span>
                <span>
                  <b>NO SAFE</b> PASSAGE
                </span>
              </div>
            </div>
            <div
              className="chart"
              aria-label="Illustrated nautical chart of the Shattered Isles"
            >
              <div className="chart-grid" />
              <span className="chart-label">
                CHART Nº 07 / UNPATROLLED WATERS
              </span>
              <div className="map-island island-one">
                <span>
                  DEAD MAN’S
                  <br />
                  REST
                </span>
              </div>
              <div className="map-island island-two">
                <span>
                  THE LOW
                  <br />
                  ISLES
                </span>
              </div>
              <div className="map-island island-three" />
              <div className="route" />
              <img
                className="hero-ship"
                src={assetUrl("png/default/ships/ship_1.png")}
                alt=""
              />
              <img
                className="enemy-ship"
                src={assetUrl("png/default/ships/ship_2.png")}
                alt=""
              />
              <span className="map-note">Here be trouble.</span>
              <div className="compass">
                N<span>✧</span>S
              </div>
              <div className="chart-bottom">
                <span>23° 18′ N &nbsp; 82° 22′ W</span>
                <span>NOT ALL WHO WANDER RETURN</span>
              </div>
            </div>
          </section>
          <nav className="tabs" aria-label="Harbor panels">
            {(["overview", "ranking", "history"] as const).map((t) => (
              <button
                key={t}
                aria-current={tab === t ? "page" : undefined}
                onClick={() => setTab(t)}
              >
                {t === "overview"
                  ? "The briefing"
                  : t === "ranking"
                    ? "Ranking"
                    : "Match History"}
                <span aria-hidden="true">
                  {t === "overview" ? "01" : t === "ranking" ? "02" : "03"}
                </span>
              </button>
            ))}
          </nav>
          {tab === "overview" ? (
            <section className="briefing">
              <div>
                <span className="eyebrow">KNOW YOUR SHIP</span>
                <h2>
                  A steady hand.
                  <br /> A loaded broadside.
                </h2>
                <p>
                  Sink a ship, earn a point. Survive until the bell — or go down
                  fighting.
                </p>
              </div>
              <div className="control-list">
                <div>
                  <span>
                    <kbd>W</kbd>
                    <kbd>A</kbd>
                    <kbd>D</kbd>
                  </span>
                  <div>
                    <b>Take the helm</b>
                    <p>Forward, turn left, turn right. Arrow keys work too.</p>
                  </div>
                </div>
                <div>
                  <span>
                    <kbd>SPACE</kbd>
                  </span>
                  <div>
                    <b>Fire ahead</b>
                    <p>A single cannonball, straight off the bow.</p>
                  </div>
                </div>
                <div>
                  <span>
                    <kbd>Q</kbd>
                    <kbd>E</kbd>
                  </span>
                  <div>
                    <b>Unleash a broadside</b>
                    <p>Three parallel shots to port or starboard.</p>
                  </div>
                </div>
              </div>
              <aside>
                <span className="eyebrow">CAPTAIN’S ADVICE</span>
                <p>
                  Red sails close the distance. Dark sails fire from afar. Keep
                  an island between you and trouble.
                </p>
                <small>Touch controls on mobile · P to pause</small>
              </aside>
            </section>
          ) : (
            <Records
              key={`${tab}-${options.duration}-${options.spawnInterval}`}
              kind={tab}
              options={options}
            />
          )}
          {last && (
            <button className="last-voyage" onClick={() => setScreen("result")}>
              Last voyage: {last.score} ships sunk · View result →
            </button>
          )}
        </main>
      )}
      {queue.length > 0 && (
        <aside className="pending" aria-live="polite">
          <span>
            {queue.length} voyage{queue.length > 1 ? "s" : ""} waiting for
            harbor registration. You can keep playing.
          </span>
          <button
            disabled={submission.isPending}
            onClick={() => {
              for (const m of queue) submission.mutate(m);
            }}
          >
            {submission.isPending ? "Sending…" : "Retry registration"}
          </button>
          {submission.isError && (
            <span>Connection failed. Your results are stored locally.</span>
          )}
        </aside>
      )}
      <footer className="site-footer">
        <span>BUILT FOR THE OPEN SEA.</span>
        <details>
          <summary>Network scenarios</summary>
          <div className="network-panel">
            <label htmlFor="scenario">Simulated harbor connection</label>
            <select
              id="scenario"
              value={scenario}
              onChange={(e) => {
                const s = e.target.value as Scenario;
                setScenario(s);
                save("scenario", s);
                void queryClient.cancelQueries();
                void queryClient.invalidateQueries();
              }}
            >
              {scenarios.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={() => {
                resetNetwork();
                setScenario("success");
                void queryClient.cancelQueries();
                void queryClient.invalidateQueries();
              }}
            >
              Reset mock records
            </button>
            <small>
              Only mock confirmations are reset. Pending voyages are preserved.
            </small>
          </div>
        </details>
        <span>REACT / PIXIJS</span>
      </footer>
      <dialog
        ref={optionsDialog}
        aria-labelledby="options-title"
        onClose={() => optionsButton.current?.focus()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget),
              next = {
                duration: Number(data.get("duration")),
                spawnInterval: Number(data.get("spawnInterval")),
              };
            if (!validOptions(next)) {
              setFormError(
                "Use 60–180 whole seconds for a session and 1–10 seconds between spawns.",
              );
              return;
            }
            save("options", next);
            setOptions(next);
            optionsDialog.current?.close();
          }}
          noValidate
        >
          <span className="eyebrow">PREPARE YOUR VOYAGE</span>
          <h2 id="options-title">Make the sea your own.</h2>
          <label htmlFor="duration">
            Game session time <small>60–180 seconds</small>
          </label>
          <input
            key={`d-${options.duration}`}
            id="duration"
            name="duration"
            type="number"
            min="60"
            max="180"
            step="1"
            defaultValue={options.duration}
            autoFocus
          />
          <label htmlFor="spawn">
            Enemy spawn time <small>1–10 seconds</small>
          </label>
          <input
            key={`s-${options.spawnInterval}`}
            id="spawn"
            name="spawnInterval"
            type="number"
            min="1"
            max="10"
            step="0.5"
            defaultValue={options.spawnInterval}
          />
          <p className="small muted">
            Shorter intervals mean busier waters. Each voyage keeps the settings
            it started with.
          </p>
          {formError && <p role="alert">{formError}</p>}
          <div className="actions">
            <button className="primary" type="submit">
              Save options
            </button>
            <button
              type="button"
              onClick={() => optionsDialog.current?.close()}
            >
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
