// tasks-chart.js - PowerPoint-optimized HTML for schedule changes
const fs = require('fs');
const path = require('path');
const child_process = require('child_process'); // For opening browser

// Function to parse CSV data
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const taskNameIndex = headers.findIndex(h => h.toLowerCase().includes('task name'));
  const origDateIndex = headers.findIndex(h => h.toLowerCase().includes('original date'));
  const newDateIndex = headers.findIndex(h => h.toLowerCase().includes('new date'));

  if (taskNameIndex === -1 || origDateIndex === -1 || newDateIndex === -1) {
    throw new Error('CSV must have columns for Task Name, Original Date, and New Date');
  }

  const tasks = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle possible quoted values with commas inside
    const values = [];
    let inQuotes = false;
    let currentValue = '';

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"' && (j === 0 || line[j - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue); // Add the last value

    const taskName = values[taskNameIndex].replace(/^"|"$/g, '').trim();
    const originalDateStr = values[origDateIndex].replace(/^"|"$/g, '').trim();
    const newDateStr = values[newDateIndex].replace(/^"|"$/g, '').trim();

    // Skip empty dates
    if (!originalDateStr || !newDateStr) {
      console.warn(`Skipping row ${i}: Missing date for task "${taskName}"`);
      continue;
    }

    // Parse dates - try multiple formats
    let originalDate = parseDate(originalDateStr);
    let newDate = parseDate(newDateStr);

    if (!originalDate || !newDate) {
      console.warn(`Skipping row ${i}: Invalid date format for task "${taskName}"`);
      continue;
    }

    tasks.push({
      name: taskName,
      originalDate,
      newDate
    });
  }

  return tasks;
}

// More robust date parsing function
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Try multiple date formats
  let date = null;

  // Try parsing with standard Date constructor
  const standardDate = new Date(dateStr);
  if (!isNaN(standardDate.getTime())) {
    date = standardDate;
  }

  // Try MM/DD/YYYY format
  if (!date && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      const parsedDate = new Date(
        parseInt(parts[2]), // Year
        parseInt(parts[0]) - 1, // Month (0-indexed)
        parseInt(parts[1]) // Day
      );
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate;
      }
    }
  }

  // Return null if all parsing attempts failed
  if (!date) return null;

  // Set to noon to avoid timezone issues
  date.setHours(12, 0, 0, 0);
  return date;
}

// Format date for display (MM/DD)
function formatDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Format full date for console output
function formatFullDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

// Get weeks between start and end date
function getWeeks(start, end) {
  const weeks = [];

  // Clone dates to avoid modifying the input
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Set to beginning/end of day
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  // Set startDate to beginning of week (Sunday)
  const dayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - dayOfWeek);

  // Iterate week by week
  let currentDate = new Date(startDate);
  let weekCounter = 1;

  while (currentDate <= endDate) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6); // Move to Saturday

    // Get week number
    weeks.push({
      number: weekCounter++,
      start: weekStart,
      end: weekEnd,
      month: weekStart.getMonth(),
      year: weekStart.getFullYear(),
      // Get formatted date string for each day in the week
      days: Array(7).fill().map((_, i) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        return formatDetailedDate(day);
      })
    });

    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return weeks;
}

// Format date as MM/DD/YYYY for exact day comparison
function formatDetailedDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

// Group weeks by month
function groupWeeksByMonth(weeks) {
  const monthMap = {};

  weeks.forEach(week => {
    // Get month from week start date
    const monthKey = `${week.year}-${week.month}`;

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        name: new Date(week.year, week.month, 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
        weeks: []
      };
    }

    monthMap[monthKey].weeks.push(week);
  });

  // Convert map to array and sort by date
  return Object.values(monthMap).sort((a, b) => {
    const monthA = a.weeks[0].month + a.weeks[0].year * 12;
    const monthB = b.weeks[0].month + b.weeks[0].year * 12;
    return monthA - monthB;
  });
}

// Check if a date string matches any day in the week
function dateInWeek(dateStr, week) {
  return week.days.includes(dateStr);
}

// Generate PowerPoint-optimized HTML for the tasks chart
function generatePowerPointHTML(tasks, months, includeExportScript) {
  // Calculate title based on date range
  const allDates = tasks.flatMap(task => [task.originalDate, task.newDate]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const titleDateRange = `${formatDate(minDate)} - ${formatDate(maxDate)}`;

  // Get all weeks as a flat array
  const allWeeks = [];
  months.forEach(month => {
    month.weeks.forEach(week => {
      allWeeks.push(week);
    });
  });

  // Convert task dates to formatted strings for comparison
  const formattedTasks = tasks.map(task => ({
    ...task,
    originalDateStr: formatDetailedDate(task.originalDate),
    newDateStr: formatDetailedDate(task.newDate)
  }));

  // Generate PowerPoint-optimized HTML
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Schedule Changes</title>
  <style>
    /* PowerPoint optimized styles */
    body { 
      font-family: Arial, sans-serif; 
      margin: 0; 
      padding: 0;
      background-color: white;
    }
    
    /* 16:9 PowerPoint slide aspect ratio wrapper */
    .slide-container {
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      position: relative;
      padding: 40px;
      box-sizing: border-box;
    }
    
    .chart-container { 
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    
    h1 { 
      color: #2b6cb0; 
      font-size: 48px;
      margin: 0 0 20px 0;
      text-align: center;
      font-weight: bold;
    }
    
    .subtitle {
      color: #4a5568;
      font-size: 28px;
      margin: 0 0 30px 0;
      text-align: center;
      font-weight: bold;
    }
    
    table { 
      border-collapse: collapse; 
      width: 100%;
      font-size: 20px;
      table-layout: fixed;
    }
    
    th, td { 
      border: 1px solid #cbd5e0; 
      padding: 10px; 
      text-align: center; 
    }
    
    th { 
      background-color: #4299e1; 
      color: white; 
      font-weight: bold;
    }
    
    .task-cell { 
      text-align: left; 
      font-weight: 600; 
      background: white;
      width: 300px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .week-cell {
      width: 70px; /* Fixed width for week cells */
    }
    
    tr:nth-child(even) { background-color: #f0f7ff; }
    tr:nth-child(odd) { background-color: #ffffff; }
    
    .bar-yellow { 
      background-color: #ecc94b; 
      border-radius: 3px; 
      height: 24px; 
      border: 1px solid #d69e2e;
      width: 100%;
    }
    
    .bar-green { 
      background-color: #48bb78; 
      border-radius: 3px; 
      height: 24px; 
      border: 1px solid #2f855a;
      width: 100%;
    }
    
    .legend { 
      display: flex; 
      gap: 40px; 
      justify-content: center; 
      margin-top: 30px; 
    }
    
    .legend-item { 
      display: flex; 
      align-items: center;
      font-size: 24px;
    }
    
    .legend-color { 
      width: 24px; 
      height: 24px; 
      border-radius: 3px; 
      margin-right: 10px; 
    }
    
    .date-info { 
      font-size: 16px; 
      color: #666; 
    }
    
    /* Export instructions */
    .export-instructions {
      position: fixed;
      top: 10px;
      right: 10px;
      background: #f8f9fa;
      border: 1px solid #ddd;
      padding: 10px;
      border-radius: 5px;
      font-size: 14px;
      width: 300px;
      z-index: 1000;
    }
    
    .export-instructions h3 {
      margin-top: 0;
      margin-bottom: 10px;
    }
    
    .export-instructions button {
      background: #4299e1;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 3px;
      cursor: pointer;
      margin-top: 10px;
    }
    
    .export-instructions button:hover {
      background: #3182ce;
    }
    
    .export-instructions .hide-button {
      position: absolute;
      top: 5px;
      right: 5px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: #666;
    }
    
    /* Table wrapper for horizontal scrolling */
    .table-wrapper {
      overflow-x: auto;
      max-width: 100%;
    }
    
    #auto-capture-info {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 20px;
      border-radius: 10px;
      z-index: 2000;
      text-align: center;
      display: none;
    }
  </style>`;

  // Auto-export script - only include if requested
  if (includeExportScript) {
    html += `
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Automatically trigger screenshot when page loads
      setTimeout(function() {
        // Show message and countdown
        const infoBox = document.createElement('div');
        infoBox.id = 'auto-capture-info';
        infoBox.innerHTML = '<h2>Preparing to capture chart...</h2>' +
                           '<p>Please do not close this window until the download completes.</p>' +
                           '<p id="countdown">Capturing in 3 seconds...</p>';
        document.body.appendChild(infoBox);
        infoBox.style.display = 'block';
        
        // Countdown
        let count = 3;
        const countdownEl = document.getElementById('countdown');
        const interval = setInterval(function() {
          count--;
          if (count <= 0) {
            clearInterval(interval);
            countdownEl.textContent = "Processing...";
            setTimeout(captureChart, 500);
          } else {
            countdownEl.textContent = 'Capturing in ' + count + ' seconds...';
          }
        }, 1000);
      }, 1000);
      
      // Function to capture chart
      function captureChart() {
        // Print the page which will open the system print dialog
        window.print();
        
        // Update the message
        document.getElementById('auto-capture-info').innerHTML = 
          '<h2>Save as JPEG/PDF</h2>' +
          '<p>Use the system print dialog to save as JPEG or PDF format.</p>' +
          '<p>For PowerPoint: Select "Microsoft Print to PDF" or save as JPEG</p>' +
          '<p>After saving, you can close this window.</p>';
      }
    });
  </script>`;
  }

  html += `
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      if (document.getElementById('hideInstructions')) {
        document.getElementById('hideInstructions').addEventListener('click', function() {
          document.getElementById('exportInstructions').style.display = 'none';
        });
      }
      
      // Print button
      if (document.getElementById('printButton')) {
        document.getElementById('printButton').addEventListener('click', function() {
          if (document.getElementById('exportInstructions')) {
            document.getElementById('exportInstructions').style.display = 'none';
          }
          window.print();
          setTimeout(function() {
            if (document.getElementById('exportInstructions')) {
              document.getElementById('exportInstructions').style.display = 'block';
            }
          }, 1000);
        });
      }
      
      // Fullscreen button
      if (document.getElementById('fullscreenButton')) {
        document.getElementById('fullscreenButton').addEventListener('click', function() {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
          } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
          } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
          }
        });
      }
      
      // Screenshot button
      if (document.getElementById('screenshotButton')) {
        document.getElementById('screenshotButton').addEventListener('click', function() {
          // Hide the instructions first
          if (document.getElementById('exportInstructions')) {
            document.getElementById('exportInstructions').style.display = 'none';
          }
          
          // Let the user know we're ready for screenshot
          alert('The page is now ready for a screenshot. You can use PrintScreen key or your system screenshot tool to capture the image. Click OK to continue.');
          
          // Show instructions again after screenshot
          if (document.getElementById('exportInstructions')) {
            document.getElementById('exportInstructions').style.display = 'block';
          }
        });
      }
    });
  </script>
</head>
<body>`;

  // Only include export instructions box if NOT auto-exporting
  if (!includeExportScript) {
    html += `
  <!-- Export instructions box -->
  <div id="exportInstructions" class="export-instructions">
    <button id="hideInstructions" class="hide-button">×</button>
    <h3>PowerPoint Export</h3>
    <ol>
      <li><button id="fullscreenButton">Go Fullscreen</button></li>
      <li><button id="screenshotButton">Prepare for Screenshot</button></li>
      <li>Take a screenshot (PrtScn)</li>
      <li>Paste into PowerPoint (Ctrl+V)</li>
      <li>OR <button id="printButton">Save as PDF</button></li>
    </ol>
  </div>`;
  }

  html += `
  <div class="slide-container">
    <h1>Schedule Changes</h1>
    <div class="subtitle">${titleDateRange}</div>
    <div class="chart-container">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="task-cell">Task</th>
  `;

  // Add month headers
  months.forEach(month => {
    html += `<th colspan="${month.weeks.length}">${month.name}</th>`;
  });

  html += `
            </tr>
            <tr>
              <th class="task-cell">Start - End</th>
  `;

  // Add week headers
  allWeeks.forEach(week => {
    html += `<th class="week-cell">W${week.number}<br>${formatDate(week.start)}</th>`;
  });

  html += `
            </tr>
          </thead>
          <tbody>
  `;

  // Add task rows
  formattedTasks.forEach((task, taskIndex) => {
    html += `
            <tr>
              <td class="task-cell" title="${task.name}">
                <div>${task.name}</div>
                <div class="date-info">${formatDate(task.originalDate)} - ${formatDate(task.newDate)}</div>
              </td>
    `;

    // Add task cells - ONLY for start and end dates, NO in-between
    allWeeks.forEach(week => {
      // Check if original or completion date falls in this week
      const originalDateInWeek = dateInWeek(task.originalDateStr, week);
      const newDateInWeek = dateInWeek(task.newDateStr, week);

      let cellContent = '';

      // Show yellow bar ONLY for original date weeks
      if (originalDateInWeek) {
        cellContent = `<div class="bar-yellow"></div>`;
      }
      // Show green bar ONLY for completion date weeks
      else if (newDateInWeek) {
        cellContent = `<div class="bar-green"></div>`;
      }

      html += `<td class="week-cell">${cellContent}</td>`;
    });

    html += `</tr>`;
  });

  html += `
          </tbody>
        </table>
      </div>
      
      <div class="legend">
        <div class="legend-item">
          <div class="legend-color bar-yellow"></div>
          <span>Original Date</span>
        </div>
        <div class="legend-item">
          <div class="legend-color bar-green"></div>
          <span>Completion Date</span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Print stylesheet - Format specifically for printing/PDF export -->
  <style type="text/css" media="print">
    @page {
      size: landscape;
      margin: 0;
    }
    
    body {
      margin: 0;
      padding: 0;
    }
    
    .export-instructions, .download-button {
      display: none !important;
    }
    
    .slide-container {
      width: 100%;
      height: 100%;
      padding: 0;
      margin: 0;
    }
  </style>
</body>
</html>
  `;

  return html;
}

// Save HTML to a file
function saveHtmlToFile(html, filePath) {
  fs.writeFileSync(filePath, html);
  return filePath;
}

// Try to open the HTML file in the default browser
function openInBrowser(filePath, autoCapture = false) {
  const fileUrl = `file://${path.resolve(filePath)}`;

  try {
    console.log(`Attempting to open ${fileUrl} in your default browser...`);

    // Cross-platform support for opening URLs
    const command = process.platform === 'win32' ? 'start' :
      process.platform === 'darwin' ? 'open' :
        'xdg-open';

    child_process.exec(`${command} "${fileUrl.replace(/"/g, '\\"')}"`);
    return true;
  } catch (error) {
    console.warn(`Could not open browser automatically: ${error.message}`);
    console.log(`Please open the file manually at: ${filePath}`);
    return false;
  }
}

// Main function to process CSV and generate PowerPoint HTML
function processCSVAndGenerateChart(inputFilePath, outputFilePath, outputType = 'jpg') {
  try {
    // Normalize output type
    outputType = outputType.toLowerCase();
    const validOutputTypes = ['html', 'jpg', 'jpeg', 'pdf'];

    if (!validOutputTypes.includes(outputType)) {
      console.warn(`Warning: Output type "${outputType}" not recognized. Defaulting to "jpg".`);
      outputType = 'jpg';
    }

    // Determine if we're doing auto-export
    const autoExport = outputType === 'jpg' || outputType === 'jpeg' || outputType === 'pdf';

    console.log(`Reading CSV file: ${inputFilePath}`);
    const csvContent = fs.readFileSync(inputFilePath, 'utf8');

    console.log('Parsing CSV data...');
    const tasks = parseCSV(csvContent);

    // Debug output - print all task dates
    console.log('\nTask dates (sorted by original date):');
    tasks.sort((a, b) => a.originalDate - b.originalDate)
      .forEach((task, index) => {
        console.log(`${index + 1}. ${task.name}: Original=${formatFullDate(task.originalDate)}, New=${formatFullDate(task.newDate)}`);
      });

    console.log(`\nSuccessfully parsed ${tasks.length} tasks`);

    // Find overall date range
    const allDates = tasks.flatMap(task => [task.originalDate, task.newDate]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    // Add buffer to the date range (2 weeks on each side)
    const startDate = new Date(minDate);
    startDate.setDate(startDate.getDate() - 14);

    const endDate = new Date(maxDate);
    endDate.setDate(endDate.getDate() + 14);

    console.log('\nGenerating chart for date range:');
    console.log(`Start: ${formatFullDate(startDate)}`);
    console.log(`End: ${formatFullDate(endDate)}`);

    // Get all weeks in the date range
    const weeks = getWeeks(startDate, endDate);
    console.log(`\nGenerated ${weeks.length} weeks`);

    // Group weeks by month
    const months = groupWeeksByMonth(weeks);
    console.log(`\nSpanning ${months.length} months:`);
    months.forEach(month => {
      console.log(`${month.name}: ${month.weeks.length} weeks`);
    });

    // Determine output file path
    const outputExt = path.extname(outputFilePath).toLowerCase();
    let htmlOutputPath;

    // Use the provided output path, but ensure it has the correct extension
    if (outputType === 'html') {
      if (!outputExt || (outputExt !== '.html' && outputExt !== '.htm')) {
        htmlOutputPath = `${outputFilePath}.html`;
      } else {
        htmlOutputPath = outputFilePath;
      }
    } else if (outputType === 'pdf') {
      htmlOutputPath = outputExt === '.pdf' ? outputFilePath : `${outputFilePath}.pdf`;
      // Remove extension for the HTML path
      htmlOutputPath = `${htmlOutputPath.slice(0, -4)}_export.html`;
    } else {
      // JPG/JPEG case
      htmlOutputPath = outputExt === '.jpg' || outputExt === '.jpeg' ?
        `${outputFilePath.slice(0, -outputExt.length)}_export.html` :
        `${outputFilePath}_export.html`;
    }

    // Generate PowerPoint HTML without auto-export script
    console.log('\nGenerating PowerPoint-optimized chart...');
    const htmlContent = generatePowerPointHTML(tasks, months, false);

    // Save to HTML file
    console.log(`\nSaving HTML to: ${htmlOutputPath}`);
    saveHtmlToFile(htmlContent, htmlOutputPath);

    // Open in browser
    const browserOpened = openInBrowser(htmlOutputPath);

    console.log(`\nProcess completed!`);

    // Provide clear instructions to the user regardless of output type
    if (!browserOpened) {
      console.log(`\nIMPORTANT: Please open this file in your browser manually: ${htmlOutputPath}`);
    }

    if (outputType === 'html') {
      console.log('\nHTML file has been generated successfully.');
    } else {
      const targetFilename = outputExt ? outputFilePath : `${outputFilePath}.${outputType}`;
      console.log(`\n=== IMPORTANT: Steps to create your ${outputType.toUpperCase()} file ===`);
      console.log('1. The browser window should now be open with your chart.');
      console.log('2. Press F11 to enter full-screen mode for best quality.');
      console.log('3. To create a JPG:');
      console.log('   - Use screenshot tool (Print Screen key, Snipping Tool, or similar)');
      console.log('   - Save the screenshot as JPG to this location:');
      console.log(`     ${targetFilename}`);
      console.log('\nAlternatively, you can use the browser print function (Ctrl+P):');
      console.log('1. Select "Save as PDF" option if available');
      console.log('2. For JPG, you can use third-party PDF to JPG converters');
      console.log('3. Save to the desired location');
    }

    return htmlOutputPath;

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node tasks-chart.js <input-csv-file> [output-file] [output-type]');
    console.error('Example: node tasks-chart.js tasks.csv chart.jpeg jpg');
    console.error('Output types: html, jpg/jpeg, pdf (default: jpg)');
    process.exit(1);
  }

  const inputFilePath = args[0];
  let outputFilePath = args[1];
  let outputType = args[2] || 'jpg';

  // If no output file specified, use ScheduleChanges.jpg
  if (!outputFilePath) {
    outputFilePath = path.join(
      process.cwd(),
      "ScheduleChanges.jpg"
    );
  }

  return { inputFilePath, outputFilePath, outputType };
}

// Run the script if called directly
if (require.main === module) {
  const { inputFilePath, outputFilePath, outputType } = parseArgs();
  processCSVAndGenerateChart(inputFilePath, outputFilePath, outputType);
} else {
  // Export for use in other modules
  module.exports = {
    processCSVAndGenerateChart,
    parseCSV,
    getWeeks,
    groupWeeksByMonth
  };
}