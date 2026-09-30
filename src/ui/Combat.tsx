import { useEffect, useRef, useState } from "react";
import { Simulation, type Action } from "../game/simulation";
import { GameRenderer, loadTextures } from "../game/renderer";
import { bindKeyboard } from "../game/input";
import { AudioBus } from "../game/audio";
import type { Options } from "../game/config";
import { playerId, type Match } from "../data/storage";
import { Telemetry, type ProfileReport } from "../game/telemetry";
declare global {
  interface Window {
    __battle?: { sim: Simulation; advance: (seconds: number) => void };
    __profile?: {
      state: () => { x: number; y: number; angle: number; elapsed: number };
      report: () => ProfileReport;
    };
    __lastProfile?: ProfileReport;
  }
}
export function Combat({
  options,
  onEnd,
  onExit,
  sound,
}: {
  options: Options;
  onEnd: (m: Match) => void;
  onExit: () => void;
  sound: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    simRef = useRef<Simulation | null>(null),
    arenaRef = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(0),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [paused, setPaused] = useState(false),
    [hud, setHud] = useState({ score: 0, time: options.duration, hp: 100 });
  const callbacks = useRef({ onEnd, onExit });
  callbacks.current = { onEnd, onExit };
  const soundRef = useRef(sound);
  soundRef.current = sound;
  useEffect(() => {
    let cancelled = false,
      renderer: GameRenderer | null = null,
      cleanup = () => {},
      ready = false,
      finished = false,
      lastHud = 0,
      lastEffect = 0;
    const sim = new Simulation(options),
      audio = new AudioBus();
    const telemetry =
      import.meta.env.VITE_PROFILE_MODE === "true" ? new Telemetry() : null;
    simRef.current = sim;
    setLoading(0);
    setError("");
    const pause = () => {
      if (!sim.ended) {
        sim.setPaused(true);
        setPaused(true);
      }
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    const update = () => {
      if (!ready || cancelled) return;
      renderer!.render(sim);
      if (sim.elapsed - lastHud > 0.1 || sim.ended) {
        setHud({
          score: sim.score,
          time: Math.ceil(options.duration - sim.elapsed),
          hp: sim.player.hp,
        });
        lastHud = sim.elapsed;
      }
      audio.enabled = soundRef.current;
      for (const e of sim.effects)
        if (e.id > lastEffect) {
          audio.play(
            e.kind === "blast"
              ? "ship_explosion_1"
              : e.kind === "muzzle"
                ? "cannon_fire_1"
                : "ship_wood_hit_1",
            0.12,
          );
          lastEffect = e.id;
        }
      if (sim.ended && !finished) {
        finished = true;
        if (telemetry) window.__lastProfile = telemetry.report(sim);
        callbacks.current.onEnd({
          id: crypto.randomUUID(),
          playerId: playerId(),
          playerName: "You",
          date: new Date().toISOString(),
          score: sim.score,
          duration: Number(sim.elapsed.toFixed(3)),
          reason: sim.ended,
          config: { ...sim.config },
          version: 1,
        });
      }
    };
    void (async () => {
      try {
        const textures = await loadTextures((v) => {
          if (!cancelled) setLoading(v * 0.95);
        });
        if (cancelled) return;
        const view = new GameRenderer();
        renderer = view;
        await view.init(host.current!, textures);
        if (cancelled) {
          view.destroy();
          return;
        }
        ready = true;
        setLoading(1);
        arenaRef.current?.focus();
        cleanup = bindKeyboard(sim, pause);
        window.addEventListener("blur", pause);
        document.addEventListener("visibilitychange", visibility);
        const testing = import.meta.env.VITE_TEST_MODE === "true";
        if (telemetry)
          window.__profile = {
            state: () => ({
              x: sim.player.x,
              y: sim.player.y,
              angle: sim.player.angle,
              elapsed: sim.elapsed,
            }),
            report: () => telemetry.report(sim),
          };
        if (testing)
          window.__battle = {
            sim,
            advance: (seconds) => {
              sim.advance(seconds);
              update();
            },
          };
        view.app.ticker.add((ticker) => {
          telemetry?.sample(performance.now(), sim);
          if (!testing) sim.advance(Math.min(ticker.deltaMS / 1000, 0.1));
          update();
        });
        update();
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Unable to load the arena.",
          );
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", visibility);
      audio.dispose();
      if (ready) renderer?.destroy();
      if (window.__battle?.sim === sim) delete window.__battle;
      if (telemetry) delete window.__profile;
      simRef.current = null;
    };
  }, [options, attempt]);
  useEffect(() => {
    if (paused) dialog.current?.showModal();
    else if (dialog.current?.open) {
      dialog.current.close();
      arenaRef.current?.focus();
    }
  }, [paused]);
  const resume = () => {
    simRef.current?.setPaused(false);
    setPaused(false);
  };
  const controls: { action: Action; label: string; key: string }[] = [
    { action: "left", label: "Turn left", key: "A" },
    { action: "forward", label: "Sail forward", key: "W" },
    { action: "right", label: "Turn right", key: "D" },
    { action: "port", label: "Port broadside", key: "Q" },
    { action: "front", label: "Front cannon", key: "SPACE" },
    { action: "starboard", label: "Starboard broadside", key: "E" },
  ];
  return (
    <main className="combat" aria-label="Active voyage">
      <header className="battle-hud">
        <div className="brand-small">✦ PIRATE BATTLE</div>
        <div>
          <span className="eyebrow">SUNK</span>
          <strong data-testid="score">
            {hud.score.toString().padStart(2, "0")}
          </strong>
        </div>
        <div>
          <span className="eyebrow">TIME LEFT</span>
          <strong data-testid="time">
            {Math.floor(hud.time / 60)}:
            {(hud.time % 60).toString().padStart(2, "0")}
          </strong>
        </div>
        <div>
          <span className="eyebrow">HULL</span>
          <strong>{hud.hp}%</strong>
        </div>
        <button
          onClick={() => {
            simRef.current?.setPaused(true);
            setPaused(true);
          }}
        >
          Pause <kbd>P</kbd>
        </button>
      </header>
      <div className="arena-frame" ref={arenaRef} tabIndex={-1}>
        <div className="canvas-host" ref={host} />
        {loading < 1 && !error && (
          <div className="arena-message" role="status">
            Charting the waters… {Math.round(loading * 100)}%
          </div>
        )}
        {error && (
          <div className="arena-message" role="alert">
            <h2>The harbor is out of reach.</h2>
            <p>
              Some game assets could not be loaded. Check your connection and
              try again.
            </p>
            <button onClick={() => setAttempt((a) => a + 1)}>
              Retry loading
            </button>
            <button onClick={onExit}>Main Menu</button>
          </div>
        )}
      </div>
      <footer className="combat-footer">
        <span>
          THE SHATTERED ISLES{" "}
          <span className="muted">
            / Keep moving. Make every broadside count.
          </span>
        </span>
        <div className="touch-controls">
          {controls.map((c) => (
            <button
              key={c.action}
              aria-label={c.label}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                if (!simRef.current?.paused)
                  simRef.current?.input.add(c.action);
              }}
              onPointerUp={() => simRef.current?.input.delete(c.action)}
              onPointerCancel={() => simRef.current?.input.delete(c.action)}
              onLostPointerCapture={() =>
                simRef.current?.input.delete(c.action)
              }
            >
              <kbd>{c.key}</kbd>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </footer>
      <dialog
        ref={dialog}
        aria-labelledby="pause-title"
        onCancel={(e) => {
          e.preventDefault();
          resume();
        }}
      >
        <span className="eyebrow">ANCHOR DROPPED</span>
        <h2 id="pause-title">Take a breath, captain.</h2>
        <p>The sea can wait. Your time and weapons are paused.</p>
        <button className="primary" autoFocus onClick={resume}>
          Resume voyage
        </button>
        <button onClick={onExit}>Abandon to Main Menu</button>
        <p className="muted small">Abandoned voyages are not recorded.</p>
      </dialog>
    </main>
  );
}
