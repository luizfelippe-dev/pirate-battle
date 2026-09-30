import { useEffect, useRef, useState } from "react";
import { Simulation } from "../game/simulation";
import { GameRenderer, loadTextures } from "../game/renderer";
import { bindKeyboard, bindMouse, InputController } from "../game/input";
import { CombatControls } from "./CombatControls";
import { AudioBus } from "../game/audio";
import { balance, type Options } from "../game/config";
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
  mouseFire,
}: {
  options: Options;
  onEnd: (m: Match) => void;
  onExit: () => void;
  sound: boolean;
  mouseFire: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    simRef = useRef<Simulation | null>(null),
    inputRef = useRef<InputController | null>(null),
    arenaRef = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(0),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [paused, setPaused] = useState(false),
    [hud, setHud] = useState({
      score: 0,
      time: options.duration,
      hp: 100,
      weapons: { front: 1, port: 1, starboard: 1 },
    });
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
      pendingPaint = 0,
      lastHud = 0,
      lastEffect = 0;
    const sim = new Simulation(options),
      input = new InputController(sim),
      audio = new AudioBus();
    const testing = import.meta.env.VITE_TEST_MODE === "true";
    const telemetry =
      import.meta.env.VITE_PROFILE_MODE === "true" ? new Telemetry() : null;
    simRef.current = sim;
    inputRef.current = input;
    setLoading(0);
    setError("");
    const pause = () => {
      if (!sim.ended) {
        input.clear();
        sim.setPaused(true);
        setPaused(true);
      }
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    const update = () => {
      if (!ready || cancelled) return;
      if (testing) {
        if (!pendingPaint)
          pendingPaint = requestAnimationFrame(() => {
            pendingPaint = 0;
            if (cancelled || !ready) return;
            renderer!.render(sim);
            renderer!.app.render();
          });
      } else renderer!.render(sim);
      if (sim.elapsed - lastHud > 0.1 || sim.ended) {
        setHud({
          score: sim.score,
          time: Math.ceil(options.duration - sim.elapsed),
          hp: sim.player.hp,
          weapons: sim.weaponReadiness(),
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
          version: balance.version,
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
        const unbindKeyboard = bindKeyboard(input, pause);
        const unbindMouse = mouseFire
          ? bindMouse(input, host.current!)
          : () => {};
        cleanup = () => {
          unbindKeyboard();
          unbindMouse();
        };
        window.addEventListener("blur", pause);
        document.addEventListener("visibilitychange", visibility);
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
        if (testing) view.app.stop();
        else
          view.app.ticker.add((ticker) => {
            telemetry?.sample(performance.now(), sim);
            sim.advance(Math.min(ticker.deltaMS / 1000, 0.1));
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
      cancelAnimationFrame(pendingPaint);
      cleanup();
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", visibility);
      audio.dispose();
      if (ready) renderer?.destroy();
      if (window.__battle?.sim === sim) delete window.__battle;
      if (telemetry) delete window.__profile;
      simRef.current = null;
      inputRef.current = null;
    };
  }, [options, attempt, mouseFire]);
  useEffect(() => {
    if (paused) dialog.current?.showModal();
    else if (dialog.current?.open) {
      dialog.current.close();
      arenaRef.current?.focus();
    }
  }, [paused]);
  const resume = () => {
    inputRef.current?.clear();
    simRef.current?.setPaused(false);
    setPaused(false);
  };
  return (
    <main className="combat" aria-label="Active voyage">
      <h1 className="sr-only">Pirate Battle — Active voyage</h1>
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
            inputRef.current?.clear();
            simRef.current?.setPaused(true);
            setPaused(true);
          }}
        >
          Pause <kbd>P</kbd>
        </button>
      </header>
      <div
        className={`arena-frame${mouseFire ? " mouse-fire" : ""}`}
        ref={arenaRef}
        tabIndex={-1}
      >
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
            /{" "}
            {mouseFire
              ? "Mouse: left fires ahead · right fires both sides"
              : "WASD / arrows to sail · Hold fire to repeat"}
          </span>
        </span>
        <CombatControls input={inputRef} readiness={hud.weapons} />
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
        <p className="small">
          WASD or arrows to sail · S / ↓ to reverse · Space / Q / E to fire
          {mouseFire ? " · Mouse: left ahead, right both sides" : ""}
        </p>
        <button className="primary" autoFocus onClick={resume}>
          Resume voyage
        </button>
        <button onClick={onExit}>Abandon to Main Menu</button>
        <p className="muted small">Abandoned voyages are not recorded.</p>
      </dialog>
    </main>
  );
}
