const { classifyFilename } = require('../backend/services/filenameClassifier');

describe('Filename classifier', () => {
  test('identifies placement logs', () => {
    const result = classifyFilename('Panel Placement Log.xlsx');
    expect(result.decision).toBe('placement');
    expect(result.domain).toBe('panel_placement');
    expect(result.shouldProcess).toBe(true);
  });

  test('rejects placement files that include seam keywords', () => {
    const result = classifyFilename('Panel_Placement_Seam_Report.xlsx');
    expect(result.decision).toBe('non_placement');
    expect(result.domain).toBe('panel_seaming');
    expect(result.shouldProcess).toBe(true);
    expect(result.reason).toBe('matched_non_placement_signal');
  });

  test('routes seam logs to seaming domain', () => {
    const result = classifyFilename('Seam Log.xlsx');
    expect(result.decision).toBe('non_placement');
    expect(result.domain).toBe('panel_seaming');
    expect(result.shouldProcess).toBe(true);
  });

  test('falls back to non-placement skip when no signals found', () => {
    const result = classifyFilename('ProjectNotes.xlsx');
    expect(result.decision).toBe('non_placement');
    expect(result.domain).toBeNull();
    expect(result.shouldProcess).toBe(false);
    expect(result.fallbackApplied).toBe(true);
  });

  test('allows manual override to placement', () => {
    const result = classifyFilename('ProjectNotes.xlsx', { overrideDomain: 'panel_placement' });
    expect(result.decision).toBe('placement');
    expect(result.domain).toBe('panel_placement');
    expect(result.overrideApplied).toBe(true);
  });
});
