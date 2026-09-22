import type { ProposalVersion, ProposalVersionLine } from "../../lib/api";

export type DiffStatus = "added" | "removed" | "changed" | "unchanged";

export interface LineDiff {
  id: string;
  catalogue_item_id: number;
  status: DiffStatus;
  name: string;
  currentLine?: ProposalVersionLine;
  previousLine?: ProposalVersionLine;
  changes?: string[];
}

function indexLines(
  lines: ProposalVersionLine[] = [],
): Map<string, ProposalVersionLine> {
  const map = new Map<string, ProposalVersionLine>();
  const counts = new Map<number, number>();
  for (const line of lines) {
    const count = counts.get(line.catalogue_item_id) ?? 0;
    counts.set(line.catalogue_item_id, count + 1);
    map.set(`${line.catalogue_item_id}#${count}`, line);
  }
  return map;
}

export function computeLineDiff(
  current: ProposalVersion,
  previous: ProposalVersion,
): LineDiff[] {
  const prevMap = indexLines(previous.content_json?.lines);
  const currMap = indexLines(current.content_json?.lines);

  const diffs: LineDiff[] = [];

  for (const [key, currLine] of currMap) {
    const prevLine = prevMap.get(key);
    if (!prevLine) {
      diffs.push({
        id: key,
        catalogue_item_id: currLine.catalogue_item_id,
        status: "added",
        name: currLine.name,
        currentLine: currLine,
      });
    } else {
      const changes: string[] = [];
      if (prevLine.quantity !== currLine.quantity) {
        changes.push(`Quantity: ${prevLine.quantity} → ${currLine.quantity}`);
      }
      if (prevLine.unit_estimate !== currLine.unit_estimate) {
        changes.push(
          `Unit estimate: $${prevLine.unit_estimate} → $${currLine.unit_estimate}`,
        );
      }
      if (prevLine.line_total !== currLine.line_total) {
        changes.push(
          `Line total: $${prevLine.line_total} → $${currLine.line_total}`,
        );
      }
      const prevAddOns = [...(prevLine.add_on_item_ids ?? [])].sort().join(",");
      const currAddOns = [...(currLine.add_on_item_ids ?? [])].sort().join(",");
      if (prevAddOns !== currAddOns) {
        changes.push("Add-ons updated");
      }
      if ((prevLine.assumptions ?? "") !== (currLine.assumptions ?? "")) {
        changes.push(
          `Assumptions: "${prevLine.assumptions ?? "None"}" → "${currLine.assumptions ?? "None"}"`,
        );
      }

      if (changes.length > 0) {
        diffs.push({
          id: key,
          catalogue_item_id: currLine.catalogue_item_id,
          status: "changed",
          name: currLine.name,
          currentLine: currLine,
          previousLine: prevLine,
          changes,
        });
      } else {
        diffs.push({
          id: key,
          catalogue_item_id: currLine.catalogue_item_id,
          status: "unchanged",
          name: currLine.name,
          currentLine: currLine,
          previousLine: prevLine,
        });
      }
    }
  }

  for (const [key, prevLine] of prevMap) {
    if (!currMap.has(key)) {
      diffs.push({
        id: key,
        catalogue_item_id: prevLine.catalogue_item_id,
        status: "removed",
        name: prevLine.name,
        previousLine: prevLine,
      });
    }
  }

  return diffs;
}
