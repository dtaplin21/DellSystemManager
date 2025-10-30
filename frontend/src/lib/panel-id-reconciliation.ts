/**
 * Panel ID Reconciliation Utility
 * 
 * Handles panel ID mismatches by looking up panels by panelNumber/rollNumber
 * when the UUID doesn't match what's in the database.
 */

import { safeAPI } from './safe-api';

export interface PanelIdentifier {
  id?: string;
  panelNumber?: string;
  rollNumber?: string;
}

/**
 * Find panel ID by panelNumber or rollNumber
 * Returns the correct panel ID from the database
 */
export async function findPanelIdByIdentifier(
  projectId: string,
  identifier: string
): Promise<string | null> {
  try {
    console.log('🔍 [Reconciliation] Looking up panel by identifier:', identifier);
    
    // Try to get panel layout from backend
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003'}/api/panels/layout/${projectId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NODE_ENV === 'development' && { 'x-dev-bypass': 'true' }),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn('⚠️ [Reconciliation] Failed to fetch panel layout:', response.status);
      return null;
    }

    const data = await response.json();
    const panels = data.panels || [];

    if (!Array.isArray(panels) || panels.length === 0) {
      console.warn('⚠️ [Reconciliation] No panels found in layout');
      return null;
    }

    // Normalize identifier for comparison (similar to backend logic)
    const normalize = (val: string | null | undefined): string | null => {
      if (!val) return null;
      let str = val.toString().trim().toUpperCase();
      
      // Handle R prefix (R21 -> P021)
      if (/^R\d{1,4}[A-Z]{0,3}$/i.test(str)) {
        const match = str.match(/^R(\d{1,4})([A-Z]{0,3})$/i);
        if (match) {
          const numeric = parseInt(match[1], 10);
          if (!Number.isNaN(numeric)) {
            const suffix = match[2] || '';
            return `P${numeric.toString().padStart(3, '0')}${suffix}`;
          }
        }
      }
      
      // Handle P prefix normalization
      str = str
        .replace(/^PANEL\s*/, 'P')
        .replace(/^PNL\s*/, 'P')
        .replace(/^PN\s*/, 'P')
        .replace(/^P#/, 'P')
        .replace(/^R\s*/, 'P')
        .replace(/^#/, '')
        .replace(/[^A-Z0-9]/g, '');

      // Canonical format (e.g. P001 or P001A)
      if (/^P\d{1,4}[A-Z]{0,3}$/.test(str)) {
        const match = str.match(/^P(\d{1,4})([A-Z]{0,3})$/);
        if (match) {
          const numeric = parseInt(match[1], 10);
          if (!Number.isNaN(numeric)) {
            const suffix = match[2] || '';
            return `P${numeric.toString().padStart(3, '0')}${suffix}`;
          }
        }
      }

      // Extract trailing digits with optional alpha suffix
      const match = str.match(/(\d{1,4})([A-Z]{0,3})$/);
      if (match) {
        const numeric = parseInt(match[1], 10);
        if (!Number.isNaN(numeric)) {
          const suffix = match[2] || '';
          return `P${numeric.toString().padStart(3, '0')}${suffix}`;
        }
      }

      return null;
    };

    const normalizedIdentifier = normalize(identifier);

    if (!normalizedIdentifier) {
      console.warn('⚠️ [Reconciliation] Could not normalize identifier:', identifier);
      return null;
    }

    // Search for matching panel
    for (const panel of panels) {
      const normalizedPanelNumber = normalize(panel.panelNumber);
      const normalizedRollNumber = normalize(panel.rollNumber);

      if (
        (normalizedPanelNumber && normalizedPanelNumber === normalizedIdentifier) ||
        (normalizedRollNumber && normalizedRollNumber === normalizedIdentifier)
      ) {
        console.log('✅ [Reconciliation] Found panel:', {
          identifier,
          normalizedIdentifier,
          foundId: panel.id,
          panelNumber: panel.panelNumber,
          rollNumber: panel.rollNumber,
        });
        return panel.id;
      }
    }

    console.warn('⚠️ [Reconciliation] Panel not found by identifier:', identifier);
    return null;
  } catch (error) {
    console.error('❌ [Reconciliation] Error finding panel by identifier:', error);
    return null;
  }
}

/**
 * Reconcile panel ID - if the panelId doesn't work, try panelNumber/rollNumber
 */
export async function reconcilePanelId(
  projectId: string,
  panel: PanelIdentifier
): Promise<string | null> {
  // If we already have an ID, check if it's valid first
  if (panel.id) {
    // Try to verify the ID is valid by checking if records exist
    try {
      const records = await safeAPI.getPanelRecords(projectId, panel.id);
      if (records && records.length > 0) {
        // ID is valid, use it
        console.log('✅ [Reconciliation] Panel ID is valid:', panel.id);
        return panel.id;
      }
    } catch (error) {
      // ID lookup failed, try reconciliation
      console.log('⚠️ [Reconciliation] Panel ID lookup failed, attempting reconciliation:', panel.id);
    }
  }

  // Try panelNumber first
  if (panel.panelNumber) {
    const foundId = await findPanelIdByIdentifier(projectId, panel.panelNumber);
    if (foundId) {
      console.log('✅ [Reconciliation] Reconciled by panelNumber:', panel.panelNumber, '->', foundId);
      return foundId;
    }
  }

  // Try rollNumber as fallback
  if (panel.rollNumber) {
    const foundId = await findPanelIdByIdentifier(projectId, panel.rollNumber);
    if (foundId) {
      console.log('✅ [Reconciliation] Reconciled by rollNumber:', panel.rollNumber, '->', foundId);
      return foundId;
    }
  }

  console.warn('⚠️ [Reconciliation] Could not reconcile panel ID for:', panel);
  return panel.id || null; // Return original ID as fallback
}

