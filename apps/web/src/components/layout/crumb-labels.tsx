import { useMemo, useState, type ReactNode } from "react";

import {
  LabelsContext,
  SetLabelContext,
  type CrumbLabels,
} from "./crumb-context";

/** Lets a page name its breadcrumb ("Regional Delivery Fleet" instead of "Opportunity"). */
export function CrumbLabelProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<CrumbLabels>({});
  const set = useMemo(
    () => (path: string, label: string | null) =>
      setLabels((prev) => {
        if (label === null) {
          if (!(path in prev)) return prev;
          const { [path]: _removed, ...rest } = prev;
          return rest;
        }
        return prev[path] === label ? prev : { ...prev, [path]: label };
      }),
    [],
  );
  return (
    <SetLabelContext.Provider value={set}>
      <LabelsContext.Provider value={labels}>{children}</LabelsContext.Provider>
    </SetLabelContext.Provider>
  );
}
