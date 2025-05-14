import * as XLSX from 'xlsx';

interface PanelRecord {
  date: string;
  panelNumber: string;
  length: number;
  width: number;
  rollNumber: string;
  location: string;
}

/**
 * Parse an Excel file containing panel records
 * 
 * Expected format follows the "Panel Placement Form" tables with columns:
 * - Date
 * - Panel #
 * - Length (ft)
 * - Width (ft)
 * - Roll Number
 * - Panel Location / Comment
 */
export function parseExcelPanels(file: File): Promise<PanelRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read file');
        }
        
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
        
        // Find the header row - it should contain "Panel #" or similar
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i];
          if (Array.isArray(row) && row.some(cell => 
            typeof cell === 'string' && 
            (cell.includes('Panel #') || cell.includes('Panel Number'))
          )) {
            headerRowIndex = i;
            break;
          }
        }
        
        if (headerRowIndex === -1) {
          throw new Error('Could not find header row containing "Panel #" in the Excel file');
        }
        
        const headerRow = jsonData[headerRowIndex];
        const columnIndices = {
          date: headerRow.findIndex((cell: string) => 
            typeof cell === 'string' && cell.includes('Date')),
          panelNumber: headerRow.findIndex((cell: string) => 
            typeof cell === 'string' && (cell.includes('Panel #') || cell.includes('Panel Number'))),
          length: headerRow.findIndex((cell: string) => 
            typeof cell === 'string' && cell.includes('Length')),
          width: headerRow.findIndex((cell: string) => 
            typeof cell === 'string' && cell.includes('Width')),
          rollNumber: headerRow.findIndex((cell: string) => 
            typeof cell === 'string' && cell.includes('Roll')),
          location: headerRow.findIndex((cell: string) => 
            typeof cell === 'string' && (cell.includes('Location') || cell.includes('Comment'))),
        };
        
        // Validate that we found all required columns
        const missingColumns = Object.entries(columnIndices)
          .filter(([_, index]) => index === -1)
          .map(([name, _]) => name);
          
        if (missingColumns.length > 0) {
          throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
        }
        
        // Process data rows
        const panels: PanelRecord[] = [];
        
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          // Skip empty rows
          if (!row || !Array.isArray(row) || row.length === 0) continue;
          
          // Skip rows without a panel number
          const panelNumber = row[columnIndices.panelNumber];
          if (!panelNumber) continue;
          
          // Extract values for this panel
          const panel: PanelRecord = {
            date: formatDate(row[columnIndices.date]),
            panelNumber: String(panelNumber),
            length: parseFloat(row[columnIndices.length]) || 0,
            width: parseFloat(row[columnIndices.width]) || 0,
            rollNumber: String(row[columnIndices.rollNumber] || ''),
            location: String(row[columnIndices.location] || ''),
          };
          
          // Validate essential fields
          if (panel.length && panel.width && panel.panelNumber) {
            panels.push(panel);
          }
        }
        
        resolve(panels);
        
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Format a date value from Excel into a consistent string format
 */
function formatDate(value: any): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  
  // Handle Excel serial date format
  if (typeof value === 'number') {
    // Excel dates are number of days since 1900-01-01 (except for the leap year bug)
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  }
  
  // Try parsing as a date
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  } catch (e) {
    // Ignore parsing errors
  }
  
  // Return as is if it's a string
  return String(value);
}

/**
 * Generate a sample Excel template file for panel data
 */
export function generateTemplateFile(): Blob {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  
  // Define the headers and some sample data
  const headers = ['Date', 'Panel #', 'Length (ft)', 'Width (ft)', 'Roll Number', 'Panel Location / Comment'];
  const sampleData = [
    ['2024-05-14', 'PA-01', 100, 22.5, 'R-101', 'Northeast corner, 2\' inset'],
    ['2024-05-14', 'PA-02', 100, 22.5, 'R-102', 'Adjacent to PA-01'],
    ['2024-05-14', 'PA-03', 75, 22.5, 'R-103', 'Northwest slope'],
  ];
  
  // Combine headers and data
  const wsData = [headers, ...sampleData];
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Panel Placement Form');
  
  // Generate blob
  const blobData = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([blobData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  return blob;
}