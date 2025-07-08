// Utility functions for panel label font sizing and positioning

export interface PanelLabelLayout {
  fontSize: number;
  topLabel: {
    x: number;
    y: number;
    width: number;
    height: number;
    align: 'center';
    verticalAlign: 'top';
    padding: number;
  };
  bottomLabel: {
    x: number;
    y: number;
    width: number;
    height: number;
    align: 'center';
    verticalAlign: 'bottom';
    padding: number;
  };
}

/**
 * Calculate font size and label positions for a panel.
 * Ensures labels are centered, spaced, and never overflow or are clipped.
 * @param width Panel width (in px or ft)
 * @param height Panel height (in px or ft)
 * @param options Optional: { minFont, maxFont, paddingRatio }
 */
export function getPanelLabelLayout(
  width: number,
  height: number,
  options?: { minFont?: number; maxFont?: number; paddingRatio?: number }
): PanelLabelLayout {
  // Use a ratio of the smaller dimension for font size
  const ratio = 0.20; // Responsive ratio (0.15-0.25 recommended)
  const minFont = options?.minFont ?? 10;
  const maxFont = options?.maxFont ?? 48;
  const paddingRatio = options?.paddingRatio ?? 0.08;

  const fontSize = Math.max(minFont, Math.min(maxFont, Math.min(width, height) * ratio));
  const padding = Math.max(4, Math.min(width, height) * paddingRatio);

  // Top label (panel number)
  const topLabel = {
    x: padding,
    y: padding,
    width: width - 2 * padding,
    height: fontSize + 2,
    align: 'center' as const,
    verticalAlign: 'top' as const,
    padding
  };

  // Bottom label (roll number)
  const bottomLabel = {
    x: padding,
    y: height - fontSize - padding,
    width: width - 2 * padding,
    height: fontSize + 2,
    align: 'center' as const,
    verticalAlign: 'bottom' as const,
    padding
  };

  return {
    fontSize,
    topLabel,
    bottomLabel
  };
}

/**
 * Assign roll numbers west to east (left to right) across each row.
 * Panels in the same row (y overlap) are sorted by x, and roll numbers increment left to right.
 * @param panels Array of panels
 * @param options Optional: { prefix: string, start: number }
 * @returns New array of panels with updated rollNumber fields
 */
export function assignRollNumbersWestToEast(
  panels: Array<{ id: string; x: number; y: number; width: number; length: number } & any>,
  options?: { prefix?: string; start?: number }
): typeof panels {
  const prefix = options?.prefix ?? 'R-';
  const start = options?.start ?? 1;
  // Group panels by row (y overlap)
  const sortedPanels = [...panels].sort((a, b) => a.y - b.y);
  const rows: Array<Array<typeof panels[0]>> = [];
  const rowThreshold = Math.max(8, Math.min(...panels.map(p => p.length)) * 0.5); // px or ft

  sortedPanels.forEach(panel => {
    // Try to find a row this panel belongs to
    let foundRow = false;
    for (const row of rows) {
      // If y overlaps with any panel in the row, add to row
      if (row.some(rp => Math.abs(panel.y - rp.y) < rowThreshold ||
                        (panel.y < rp.y + rp.length && panel.y + panel.length > rp.y))) {
        row.push(panel);
        foundRow = true;
        break;
      }
    }
    if (!foundRow) {
      rows.push([panel]);
    }
  });

  // Sort each row by x (left to right)
  rows.forEach(row => row.sort((a, b) => a.x - b.x));

  // Assign roll numbers
  let rollNum = start;
  const updatedPanels: typeof panels = [];
  rows.forEach(row => {
    row.forEach(panel => {
      updatedPanels.push({ ...panel, rollNumber: `${prefix}${rollNum++}` });
    });
  });

  // Preserve original order
  return panels.map(panel => updatedPanels.find(p => p.id === panel.id) || panel);
} 