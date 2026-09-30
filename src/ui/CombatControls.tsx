import type { RefObject } from "react";
import type { InputController } from "../game/input";
import type { Action, Weapon } from "../game/simulation";

interface Control {
  action: Action;
  label: string;
  key: string;
  symbol: string;
  shortLabel: string;
  weapon?: Weapon;
}
const movement: Control[] = [
  {
    action: "left",
    label: "Turn left",
    key: "A",
    symbol: "↶",
    shortLabel: "Left",
  },
  {
    action: "forward",
    label: "Sail forward",
    key: "W",
    symbol: "↑",
    shortLabel: "Forward",
  },
  {
    action: "reverse",
    label: "Sail backward",
    key: "S",
    symbol: "↓",
    shortLabel: "Reverse",
  },
  {
    action: "right",
    label: "Turn right",
    key: "D",
    symbol: "↷",
    shortLabel: "Right",
  },
];
const weapons: Control[] = [
  {
    action: "port",
    label: "Port broadside",
    key: "Q",
    symbol: "↞",
    weapon: "port",
    shortLabel: "Port",
  },
  {
    action: "front",
    label: "Front cannon",
    key: "SPACE",
    symbol: "↑",
    weapon: "front",
    shortLabel: "Front",
  },
  {
    action: "starboard",
    label: "Starboard broadside",
    key: "E",
    symbol: "↠",
    weapon: "starboard",
    shortLabel: "Starboard",
  },
];

export function CombatControls({
  input,
  readiness,
}: {
  input: RefObject<InputController | null>;
  readiness: Record<Weapon, number>;
}) {
  const control = (c: Control) => (
    <button
      key={c.action}
      data-action={c.action}
      aria-label={c.label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        input.current?.press(`pointer:${e.pointerId}:${c.action}`, [c.action]);
      }}
      onPointerUp={(e) =>
        input.current?.release(`pointer:${e.pointerId}:${c.action}`)
      }
      onPointerCancel={(e) =>
        input.current?.release(`pointer:${e.pointerId}:${c.action}`)
      }
      onLostPointerCapture={(e) =>
        input.current?.release(`pointer:${e.pointerId}:${c.action}`)
      }
      onKeyDown={(e) => {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          if (!e.repeat)
            input.current?.press(`control:${c.action}`, [c.action]);
        }
      }}
      onKeyUp={(e) => {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          input.current?.release(`control:${c.action}`);
        }
      }}
      onBlur={() => input.current?.release(`control:${c.action}`)}
    >
      <kbd>{c.key}</kbd>
      <span className="touch-symbol" aria-hidden="true">
        {c.symbol}
      </span>
      <span className="control-label">
        <span className="desktop-label">{c.label}</span>
        <span className="touch-label">{c.shortLabel}</span>
      </span>
      {c.weapon && (
        <span className="reload-track" aria-hidden="true">
          <span style={{ transform: `scaleX(${readiness[c.weapon]})` }} />
        </span>
      )}
    </button>
  );
  return (
    <div className="touch-controls">
      <div className="helm-controls" role="group" aria-label="Helm controls">
        {movement.map(control)}
      </div>
      <div
        className="weapon-controls"
        role="group"
        aria-label="Cannons · bars show reload progress"
      >
        {weapons.map(control)}
      </div>
    </div>
  );
}
