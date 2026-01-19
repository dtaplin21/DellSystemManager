/**
 * Panel Position Sync Strategy
 * 
 * Strategy: Backend is source of truth, localStorage is cache with expiration
 * - Backend positions always take precedence unless they're default/placeholder
 * - localStorage positions are used as fallback for panels not in backend
 * - localStorage entries expire after 7 days
 * - Conflicts are resolved by timestamp (newer wins)
 */

export interface PanelPosition {
  x: number;
  y: number;
  rotation?: number;
  timestamp?: number; // When this position was last updated (milliseconds since epoch)
  backendSynced?: boolean; // Whether this position was successfully saved to backend
}

export interface PanelPositionMap {
  [panelId: string]: PanelPosition;
}

export interface CachedPositionData {
  data: PanelPositionMap;
  timestamp: number;
  expiresAt: number;
  version: number; // For future schema migrations
}

const STORAGE_KEY = 'panelLayoutPositions';
const CACHE_VERSION = 1;
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Check if a position is a default/placeholder position
 */
export function isDefaultPosition(position: PanelPosition): boolean {
  const { x, y } = position;
  return (
    (x === 50 && y === 50) ||
    (x === 0 && y === 0) ||
    (Math.abs(x - 50) < 10 && Math.abs(y - 50) < 10)
  );
}

/**
 * Check if a position is valid
 */
export function isValidPosition(position: PanelPosition): boolean {
  const { x, y } = position;
  return (
    typeof x === 'number' &&
    typeof y === 'number' &&
    !isNaN(x) &&
    !isNaN(y) &&
    isFinite(x) &&
    isFinite(y)
  );
}

/**
 * Load cached positions from localStorage with expiration check
 */
export function loadCachedPositions(): PanelPositionMap {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);
    
    // Check if it's the new format with metadata
    if (parsed.data && parsed.timestamp && parsed.expiresAt) {
      const cached: CachedPositionData = parsed;
      
      // Check expiration
      if (Date.now() > cached.expiresAt) {
        console.log('[PanelSync] Cached positions expired, clearing');
        localStorage.removeItem(STORAGE_KEY);
        return {};
      }
      
      // Check version compatibility
      if (cached.version !== CACHE_VERSION) {
        console.log('[PanelSync] Cache version mismatch, clearing');
        localStorage.removeItem(STORAGE_KEY);
        return {};
      }
      
      return cached.data;
    }
    
    // Legacy format - migrate it
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      console.log('[PanelSync] Migrating legacy localStorage format');
      const migrated: PanelPositionMap = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value && typeof value === 'object' && 'x' in value && 'y' in value) {
          migrated[key] = value as PanelPosition;
        }
      }
      saveCachedPositions(migrated);
      return migrated;
    }
    
    return {};
  } catch (error) {
    console.warn('[PanelSync] Error loading cached positions:', error);
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

/**
 * Save positions to localStorage with metadata
 * @param positions - Panel positions to save
 * @param markAsSynced - Whether to mark all positions as synced to backend (default: false)
 */
export function saveCachedPositions(positions: PanelPositionMap, markAsSynced: boolean = false): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const now = Date.now();
    
    // Add timestamp and sync status to positions if not present
    const positionsWithMetadata: PanelPositionMap = {};
    for (const [panelId, pos] of Object.entries(positions)) {
      positionsWithMetadata[panelId] = {
        ...pos,
        timestamp: pos.timestamp || now,
        backendSynced: markAsSynced ? true : (pos.backendSynced ?? false),
      };
    }
    
    const cached: CachedPositionData = {
      data: positionsWithMetadata,
      timestamp: now,
      expiresAt: now + CACHE_DURATION_MS,
      version: CACHE_VERSION,
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.warn('[PanelSync] Error saving cached positions:', error);
    // If quota exceeded, try to clear old entries
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('[PanelSync] Storage quota exceeded, clearing expired entries');
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

/**
 * Clear cached positions
 */
export function clearCachedPositions(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Merge backend and cached positions intelligently
 * 
 * Strategy:
 * 1. Backend positions are source of truth (unless cache is newer and unsynced)
 * 2. Cached positions fill in gaps for panels not in backend
 * 3. If backend has defaults, use cached if available
 * 4. Prefer newer positions when there's a conflict (timestamp-based)
 * 5. Remove positions for panels that no longer exist
 */
export function mergePositions(
  backendPanels: Array<{ id: string; x: number; y: number; rotation?: number; updated_at?: string | Date }>,
  cachedPositions: PanelPositionMap
): PanelPositionMap {
  const merged: PanelPositionMap = {};
  const backendPanelIds = new Set<string>();
  
  // Process backend panels first
  for (const panel of backendPanels) {
    backendPanelIds.add(panel.id);
    
    // Convert backend updated_at to timestamp
    let backendTimestamp: number;
    if (panel.updated_at) {
      backendTimestamp = typeof panel.updated_at === 'string' 
        ? new Date(panel.updated_at).getTime() 
        : panel.updated_at.getTime();
    } else {
      backendTimestamp = Date.now(); // Assume current time if not provided
    }
    
    const backendPos: PanelPosition = {
      x: panel.x,
      y: panel.y,
      rotation: panel.rotation,
      timestamp: backendTimestamp,
      backendSynced: true, // Backend positions are always synced
    };
    
    const cachedPos = cachedPositions[panel.id];
    
    // Conflict resolution: prefer newer position
    if (cachedPos && cachedPos.timestamp) {
      const cachedTime = cachedPos.timestamp;
      const backendTime = backendTimestamp;
      
      // If cache is newer and not synced to backend, prefer cache (user's recent change)
      if (cachedTime > backendTime && cachedPos.backendSynced === false) {
        console.log(`[PanelSync] Cache position is newer for panel ${panel.id} (cache: ${new Date(cachedTime).toISOString()}, backend: ${new Date(backendTime).toISOString()}), using cache`);
        merged[panel.id] = cachedPos;
        continue;
      }
      
      // If cache is newer but already synced, backend is more authoritative
      if (cachedTime > backendTime && cachedPos.backendSynced === true) {
        console.log(`[PanelSync] Cache is newer but synced, using backend for panel ${panel.id}`);
        merged[panel.id] = backendPos;
        continue;
      }
    }
    
    // If backend has default position, check cache
    if (isDefaultPosition(backendPos) && cachedPos) {
      if (isValidPosition(cachedPos) && !isDefaultPosition(cachedPos)) {
        // Use cached position if it's valid and not default
        console.log(`[PanelSync] Using cached position for panel ${panel.id} (backend has default)`);
        merged[panel.id] = cachedPos;
      } else {
        // Backend default is fine
        merged[panel.id] = backendPos;
      }
    } else if (isValidPosition(backendPos)) {
      // Backend has valid position, use it
      merged[panel.id] = backendPos;
    } else if (cachedPos) {
      // Backend position invalid, fallback to cache
      console.log(`[PanelSync] Backend position invalid for panel ${panel.id}, using cache`);
      merged[panel.id] = cachedPos;
    } else {
      // No valid position available
      merged[panel.id] = backendPos;
    }
  }
  
  // Add cached positions for panels not in backend (new panels, etc.)
  for (const [panelId, cachedPos] of Object.entries(cachedPositions)) {
    if (!backendPanelIds.has(panelId) && isValidPosition(cachedPos)) {
      console.log(`[PanelSync] Adding cached position for panel ${panelId} (not in backend)`);
      merged[panelId] = cachedPos;
    }
  }
  
  return merged;
}

/**
 * Sync positions: merge backend and cache, then save back to cache
 */
export function syncPositions(
  backendPanels: Array<{ id: string; x: number; y: number; rotation?: number; updated_at?: string | Date }>
): PanelPositionMap {
  const cached = loadCachedPositions();
  const merged = mergePositions(backendPanels, cached);
  
  // Save merged positions back to cache (preserve sync status)
  // Don't mark as synced here - only mark after successful backend save
  saveCachedPositions(merged, false);
  
  return merged;
}

/**
 * Update a single panel position in cache
 * @param panelId - Panel ID
 * @param position - New position
 * @param markAsSynced - Whether to mark as synced to backend (default: false)
 */
export function updateCachedPosition(
  panelId: string,
  position: PanelPosition,
  markAsSynced: boolean = false
): void {
  const cached = loadCachedPositions();
  cached[panelId] = {
    ...position,
    timestamp: position.timestamp || Date.now(),
    backendSynced: markAsSynced ? true : (position.backendSynced ?? false),
  };
  saveCachedPositions(cached, false); // Don't mark all as synced, just this one
}

/**
 * Mark a panel position as synced to backend
 */
export function markPositionAsSynced(panelId: string): void {
  const cached = loadCachedPositions();
  if (cached[panelId]) {
    cached[panelId] = {
      ...cached[panelId],
      backendSynced: true,
    };
    saveCachedPositions(cached, false);
  }
}

/**
 * Mark multiple panel positions as synced to backend
 */
export function markPositionsAsSynced(panelIds: string[]): void {
  const cached = loadCachedPositions();
  let updated = false;
  
  for (const panelId of panelIds) {
    if (cached[panelId]) {
      cached[panelId] = {
        ...cached[panelId],
        backendSynced: true,
      };
      updated = true;
    }
  }
  
  if (updated) {
    saveCachedPositions(cached, false);
  }
}

/**
 * Get positions that are not synced to backend (failed saves)
 */
export function getUnsyncedPositions(): PanelPositionMap {
  const cached = loadCachedPositions();
  const unsynced: PanelPositionMap = {};
  
  for (const [panelId, pos] of Object.entries(cached)) {
    if (pos.backendSynced === false) {
      unsynced[panelId] = pos;
    }
  }
  
  return unsynced;
}

/**
 * Remove a panel position from cache
 */
export function removeCachedPosition(panelId: string): void {
  const cached = loadCachedPositions();
  delete cached[panelId];
  saveCachedPositions(cached);
}

