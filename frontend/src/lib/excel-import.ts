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
 * Parses panel data from an Excel file
 */
export async function parseExcelPanels(file: File): Promise<PanelRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        if (!e.target?.result) {
          reject(new Error('Failed to read file'));
          return;
        }
        
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Map and validate data
        const panelRecords = jsonData.map((row: any): PanelRecord => {
          // Check if panel number exists
          if (!row['Panel Number'] && !row['PanelNumber'] && !row['Panel #']) {
            throw new Error('Panel Number is required in Excel file');
          }
          
          // Format date if present and not already string
          let dateStr = row['Date'] || row['Installation Date'] || new Date().toISOString().slice(0, 10);
          if (dateStr instanceof Date) {
            dateStr = dateStr.toISOString().slice(0, 10);
          }
          
          // Map row data to panel record
          return {
            date: dateStr,
            panelNumber: row['Panel Number'] || row['PanelNumber'] || row['Panel #'] || '',
            length: parseFloat(row['Length'] || row['Length (ft)'] || '100'),
            width: parseFloat(row['Width'] || row['Width (ft)'] || '40'),
            rollNumber: row['Roll Number'] || row['RollNumber'] || row['Roll #'] || '',
            location: row['Location'] || row['Position'] || row['Comment'] || ''
          };
        });
        
        resolve(panelRecords);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Generates a template Excel file for panel import
 */
export function generateTemplateFile(): Blob {
  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  // Sample data
  const sampleData = [
    {
      'Date': '2025-05-14',
      'Panel Number': 'A1',
      'Length (ft)': 100,
      'Width (ft)': 40,
      'Roll Number': 'R-101',
      'Location': 'Northeast corner'
    },
    {
      'Date': '2025-05-14',
      'Panel Number': 'A2',
      'Length (ft)': 100,
      'Width (ft)': 40,
      'Roll Number': 'R-102',
      'Location': 'Adjacent to A1'
    }
  ];
  
  // Create worksheet with sample data
  const ws = XLSX.utils.json_to_sheet(sampleData);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Panels');
  
  // Generate Excel file as blob
  const excelData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}