// Test the actual header matching logic
function testHeaderMatching() {
  // Headers from Excel (what the AI sees)
  const headers = ["null", "Date", "Panel #", "Length", "Width", "Roll Number", "null", "Panel Location / Comment", "null", "null", "null"];
  
  // Data row from Excel
  const row = [null, "45230", "1", "485", "22", "1059", null, "area A floor", null, null, null];
  
  console.log('Headers:', headers);
  console.log('Row:', row);
  
  // Convert to lowercase for comparison (what the AI does)
  const headerKeywords = headers.map(h => h ? h.toString().toLowerCase() : '');
  const cellValues = row.map(cell => cell ? cell.toString().toLowerCase() : '');
  
  console.log('\nHeader keywords:', headerKeywords);
  console.log('Cell values:', cellValues);
  
  let headerMatches = 0;
  
  cellValues.forEach(cell => {
    if (headerKeywords.includes(cell)) {
      headerMatches++;
      console.log(`Match found: "${cell}" is in headers`);
    }
  });
  
  console.log(`\nHeader matches: ${headerMatches}`);
  console.log(`Headers length: ${headers.length}`);
  console.log(`Threshold: ${headers.length / 3}`);
  console.log(`Is rejected as header row: ${headerMatches > headers.length / 3}`);
}

testHeaderMatching();
