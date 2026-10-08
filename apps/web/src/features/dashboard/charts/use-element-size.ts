import { useEffect, useRef, useState } from "react";

/** Tracks an element's content box so charts can draw in real pixels. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setSize((prev) => {
        const next = {
          width: Math.round(el.clientWidth),
          height: Math.round(el.clientHeight),
        };
        return prev.width === next.width && prev.height === next.height
          ? prev
          : next;
      });
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}
