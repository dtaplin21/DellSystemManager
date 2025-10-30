/**
 * LocalStorage Cleanup Utility
 * 
 * Cleans up stale panel IDs from localStorage that no longer exist in the database.
 */

export interface PanelPosition {
  x: number;
  y: number;
  rotation?: number;
  shape?: string;
}

export interface PanelPositionMap {
  [panelId: string]: PanelPosition;
}

/**
 * Clean stale panel IDs from localStorage
 * Removes panel positions for panels that don't exist in the database
 */
export async function cleanupStalePanelIds(
  projectId: string,
  onProgress?: (message: string) => void
): Promise<{
  removed: number;
  kept: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let removed = 0;
  let kept = 0;

  try {
    onProgress?.('🔍 Checking localStorage for stale panel IDs...');

    // Load panel positions from localStorage
    const storageKey = 'panelLayoutPositions';
    const stored = localStorage.getItem(storageKey);
    
    if (!stored) {
      onProgress?.('✅ No panel positions found in localStorage');
      return { removed: 0, kept: 0, errors: [] };
    }

    let positionMap: PanelPositionMap;
    try {
      positionMap = JSON.parse(stored);
    } catch (error) {
      onProgress?.('⚠️ Invalid localStorage data, clearing...');
      localStorage.removeItem(storageKey);
      return { removed: 0, kept: 0, errors: ['Invalid localStorage data format'] };
    }

    const panelIds = Object.keys(positionMap);
    onProgress?.(`📊 Found ${panelIds.length} panel positions in localStorage`);

    // Fetch valid panel IDs from backend
    onProgress?.('🔄 Fetching valid panel IDs from database...');
    
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003'}/api/panels/layout/${projectId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.NODE_ENV === 'development' && { 'x-dev-bypass': 'true' }),
        },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const errorMsg = `Failed to fetch panel layout: ${response.status}`;
      errors.push(errorMsg);
      onProgress?.(`❌ ${errorMsg}`);
      return { removed: 0, kept: 0, errors };
    }

    const data = await response.json();
    const validPanelIds = new Set<string>();
    
    if (Array.isArray(data.panels)) {
      data.panels.forEach((panel: any) => {
        if (panel.id) {
          validPanelIds.add(panel.id);
        }
      });
    }

    onProgress?.(`✅ Found ${validPanelIds.size} valid panels in database`);

    // Identify stale IDs
    const staleIds: string[] = [];
    const validIds: string[] = [];

    panelIds.forEach(panelId => {
      if (validPanelIds.has(panelId)) {
        validIds.push(panelId);
        kept++;
      } else {
        staleIds.push(panelId);
        removed++;
      }
    });

    if (staleIds.length === 0) {
      onProgress?.('✅ No stale panel IDs found - all IDs are valid');
      return { removed: 0, kept, errors: [] };
    }

    // Remove stale entries
    onProgress?.(`🧹 Removing ${staleIds.length} stale panel IDs...`);
    staleIds.forEach(id => {
      delete positionMap[id];
    });

    // Save cleaned position map back to localStorage
    if (Object.keys(positionMap).length === 0) {
      localStorage.removeItem(storageKey);
      onProgress?.('✅ Removed all positions (no valid positions remaining)');
    } else {
      localStorage.setItem(storageKey, JSON.stringify(positionMap));
      onProgress?.(`✅ Cleaned localStorage: removed ${staleIds.length} stale IDs, kept ${validIds.length} valid IDs`);
    }

    return { removed, kept, errors };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMsg);
    onProgress?.(`❌ Error during cleanup: ${errorMsg}`);
    return { removed, kept, errors };
  }
}

/**
 * Clean stale panel IDs silently (without progress callbacks)
 */
export async function cleanupStalePanelIdsSilent(
  projectId: string
): Promise<{ removed: number; kept: number; errors: string[] }> {
  return cleanupStalePanelIds(projectId);
}

/**
 * Clean all panel positions from localStorage (nuclear option)
 */
export function clearAllPanelPositions(): void {
  const storageKey = 'panelLayoutPositions';
  localStorage.removeItem(storageKey);
  console.log('🧹 [Cleanup] Cleared all panel positions from localStorage');
}

/**
 * Clean panel positions for a specific project
 * (Currently all projects share the same key, but this is for future use)
 */
export function clearProjectPanelPositions(projectId: string): void {
  // For now, panel positions are stored globally
  // In the future, this could be project-specific
  clearAllPanelPositions();
  console.log('🧹 [Cleanup] Cleared panel positions for project:', projectId);
}

