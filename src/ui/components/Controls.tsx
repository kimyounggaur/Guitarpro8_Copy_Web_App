import { useId, useRef, useState, type KeyboardEvent, type ReactNode, type HTMLAttributes } from "react";

interface Choice<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}
function keyboardChoice<T extends string>(items: Choice<T>[], current: T, key: string): T | undefined {
  const enabled = items.filter((item) => !item.disabled);
  if (!enabled.length) return;
  const index = enabled.findIndex((item) => item.value === current);
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return enabled[(index + 1) % enabled.length].value;
    case "ArrowLeft":
    case "ArrowUp":
      return enabled[(index - 1 + enabled.length) % enabled.length].value;
    case "Home":
      return enabled[0].value;
    case "End":
      return enabled[enabled.length - 1].value;
  }
}
export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
  activation = "automatic"
}: {
  label: string;
  items: Array<Choice<T> & { content: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  activation?: "automatic" | "manual";
}) {
  const id = useId(),
    refs = useRef(new Map<T, HTMLButtonElement>());
  const [focus, setFocus] = useState<T | null>(null);
  function keyDown(event: KeyboardEvent, current: T) {
    const next = keyboardChoice(items, current, event.key);
    if (next === undefined) return;
    event.preventDefault();
    setFocus(next);
    refs.current.get(next)?.focus();
    if (activation === "automatic") onChange(next);
  }
  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="uiTabs"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocus(null);
        }}
      >
        {items.map((item) => (
          <button
            key={item.value}
            id={`${id}-tab-${item.value}`}
            type="button"
            role="tab"
            ref={(el) => {
              if (el) refs.current.set(item.value, el);
              else refs.current.delete(item.value);
            }}
            aria-selected={item.value === value}
            aria-controls={`${id}-panel-${item.value}`}
            tabIndex={item.value === (focus ?? value) ? 0 : -1}
            disabled={item.disabled}
            onKeyDown={(event) => keyDown(event, item.value)}
            onClick={() => {
              setFocus(item.value);
              onChange(item.value);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div
          key={item.value}
          id={`${id}-panel-${item.value}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${item.value}`}
          hidden={item.value !== value}
          tabIndex={0}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  label,
  items,
  value,
  onChange
}: {
  label: string;
  items: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <div role="radiogroup" className="uiSegmented" aria-label={label}>
      {items.map((item) => (
        <label key={item.value}>
          <input
            type="radio"
            name={name}
            checked={item.value === value}
            disabled={item.disabled}
            onChange={() => onChange(item.value)}
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}

export function SplitterHandle({
  label,
  orientation,
  value,
  min,
  max,
  onResize,
  ...events
}: Omit<HTMLAttributes<HTMLDivElement>, "onResize"> & {
  label: string;
  orientation: "horizontal" | "vertical";
  value: number;
  min: number;
  max: number;
  onResize: (value: number) => void;
}) {
  return (
    <div
      {...events}
      className={`uiSplitter ${events.className ?? ""}`}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onKeyDown={(event) => {
        events.onKeyDown?.(event);
        if (event.defaultPrevented) return;
        const [down, up] =
          orientation === "vertical" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
        const step = event.shiftKey ? 10 : 1;
        if (![down, up, "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        onResize(
          Math.max(
            min,
            Math.min(
              max,
              event.key === "Home"
                ? min
                : event.key === "End"
                  ? max
                  : value + (event.key === up ? step : -step)
            )
          )
        );
      }}
    />
  );
}
