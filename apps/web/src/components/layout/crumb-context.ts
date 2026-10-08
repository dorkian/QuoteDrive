import { createContext, useContext, useEffect } from "react";

export type CrumbLabels = Record<string, string>;

export const LabelsContext = createContext<CrumbLabels>({});
export const SetLabelContext = createContext<
  (path: string, label: string | null) => void
>(() => {});

export function useCrumbLabels(): CrumbLabels {
  return useContext(LabelsContext);
}

/** Names the breadcrumb for `path` while the calling page is mounted. */
export function useCrumbLabel(
  path: string | null,
  label: string | null | undefined,
): void {
  const set = useContext(SetLabelContext);
  useEffect(() => {
    if (!path || !label) return;
    set(path, label);
    return () => set(path, null);
  }, [path, label, set]);
}
