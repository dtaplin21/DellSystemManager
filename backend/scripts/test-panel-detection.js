// Test the panel number detection logic
function testPanelDetection() {
  const row = [null, "45230", "1", "485", "22", "1059", null, "area A floor", null, null, null];
  
  console.log('Row:', row);
  
  const hasNumericPanel = row.some(cell => {
    if (!cell) return false;
    const str = cell.toString().trim();
    console.log(`Testing cell: "${str}"`);
    
    // Check for numeric values that could be panel numbers
    const isNumeric = /^\d+$/.test(str);
    const inRange = parseInt(str) > 0 && parseInt(str) < 1000;
    
    console.log(`  - Is numeric: ${isNumeric}`);
    console.log(`  - In range: ${inRange}`);
    
    const result = isNumeric && inRange;
    console.log(`  - Result: ${result}`);
    
    return result;
  });
  
  console.log(`\nhasNumericPanel: ${hasNumericPanel}`);
  console.log(`Would return: ${hasNumericPanel ? 'true' : 'true (line 629 bug!)'}`);
}

testPanelDetection();
