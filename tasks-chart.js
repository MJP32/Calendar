// tasks-chart.js - PowerPoint-optimized HTML for schedule changes
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

/**
 * Parse CSV data into task objects
 * @param {string} csvContent - CSV content as string
 * @returns {Array} Array of task objects
 */
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

    // Parse CSV values handling quoted values with commas
    const values = parseCSVLine(line);

    const taskName = values[taskNameIndex].replace(/^"|"$/g, '').trim();
    const originalDateStr = values[origDateIndex].replace(/^"|"$/g, '').trim();
    const newDateStr = values[newDateIndex].replace(/^"|"$/g, '').trim();

    // Skip empty dates
    if (!originalDateStr || !newDateStr) {
      console.warn(`Skipping row ${i}: Missing date for task "${taskName}"`);
      continue;
    }

    // Parse dates
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

/**
 * Parse a CSV line handling quoted values
 * @param {string} line - CSV line
 * @returns {Array} Array of values
 */
function parseCSVLine(line) {
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
  return values;
}

/**
 * Parse date string in multiple formats
 * @param {string} dateStr - Date string
 * @returns {Date|null} Date object or null if invalid
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

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

/**
 * Format date for display (MM/DD)
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
function formatDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Format full date for console output (MM/DD/YYYY)
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
function formatFullDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

/**
 * Format date as MM/DD/YYYY for exact comparison
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
function formatDetailedDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

/**
 * Get weeks between start and end date
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Array} Array of week objects
 */
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

    // Get formatted date string for each day in the week
    const days = Array(7).fill().map((_, i) => {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      return formatDetailedDate(day);
    });

    // Create week object
    weeks.push({
      number: weekCounter++,
      start: weekStart,
      end: weekEnd,
      month: weekStart.getMonth(),
      year: weekStart.getFullYear(),
      days
    });

    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return weeks;
}

/**
 * Group weeks by month
 * @param {Array} weeks - Array of week objects
 * @returns {Array} Array of month objects
 */
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

/**
 * Check if a date string matches any day in the week
 * @param {string} dateStr - Date string
 * @param {Object} week - Week object
 * @returns {boolean} True if date is in week
 */
function dateInWeek(dateStr, week) {
  return week.days.includes(dateStr);
}

/**
 * Generate PowerPoint-optimized HTML for the tasks chart
 * @param {Array} tasks - Array of task objects
 * @param {Array} months - Array of month objects 
 * @returns {string} HTML content
 */
function generatePowerPointHTML(tasks, months) {
  // Calculate title based on date range
  const allDates = tasks.flatMap(task => [task.originalDate, task.newDate]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const titleDateRange = `${formatDate(minDate)} - ${formatDate(maxDate)}`;

  // Get all weeks as a flat array
  const allWeeks = months.flatMap(month => month.weeks);

  // Convert task dates to formatted strings for comparison
  const formattedTasks = tasks.map(task => ({
    ...task,
    originalDateStr: formatDetailedDate(task.originalDate),
    newDateStr: formatDetailedDate(task.newDate)
  }));

  // Generate HTML content
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Schedule Changes</title>
  <style>
    /* Basic styling */
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
    
    @media print {
      .slide-container {
        width: 100%;
        height: auto;
      }
    }
    
    .chart-container { 
      width: 100%;
      height: 100%;
      overflow: hidden;
      padding: 20px;
      box-sizing: border-box;
      background-color: white;
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
      border-bottom: 4px solid #3182ce;
      border-radius: 0;
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
    
    /* Only keep bottom border, no left/top/right borders */
    table { 
      border-collapse: collapse; 
      width: 100%;
      font-size: 20px;
      table-layout: fixed;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      margin-bottom: 20px;
      border: none;
      border-bottom: 4px solid #3182ce;
    }
    
    td, th {
      border: 1px solid #cbd5e0;
      padding: 10px;
      text-align: center;
    }
    
    th { 
      background-color: #4299e1; 
      color: white; 
      font-weight: bold;
      border-bottom: 2px solid #3182ce;
    }
    
    /* Task cell styling */
    .task-cell { 
      text-align: left; 
      font-weight: 600; 
      background: #f8fafc;
      width: 450px;
      white-space: normal;
      overflow: visible;
      word-wrap: break-word;
      font-size: 18px;
      line-height: 1.4;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 14px 12px;
      border-bottom: 2px solid #3182ce;
    }
    
    .task-name {
      color: #2d3748;
      margin-bottom: 8px;
      display: block;
      font-weight: 600;
    }
    
    .week-cell {
      width: 70px; /* Fixed width for week cells */
    }
    
    tbody tr:last-child td {
      border-bottom: 4px solid #3182ce !important;
    }
    
    tr:nth-child(even) { background-color: #f0f7ff; }
    tr:nth-child(odd) { background-color: #ffffff; }
    
    tr:hover td.task-cell {
      background-color: #ebf8ff;
    }
    
    /* Color bars */
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
    
    .date-info { 
      font-size: 14px; 
      color: #718096;
      font-weight: normal;
      padding-top: 3px;
      border-top: 1px dotted #e2e8f0;
    }
    
    /* Legend styling */
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
  </style>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Export instructions interactions
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
<body>
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
  </div>

  <div class="slide-container">
    <h1>Schedule Changes</h1>
    <div class="subtitle">${titleDateRange}</div>
    <div class="chart-container">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="task-cell">Task</th>
              ${months.map(month => `<th colspan="${month.weeks.length}">${month.name}</th>`).join('')}
            </tr>
            <tr>
              <th class="task-cell">Start - End</th>
              ${allWeeks.map(week => `<th class="week-cell">W${week.number}<br>${formatDate(week.start)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${formattedTasks.map(task => `
            <tr>
              <td class="task-cell">
                <div class="task-name">${task.name}</div>
                <div class="date-info">${formatDate(task.originalDate)} - ${formatDate(task.newDate)}</div>
              </td>
              ${allWeeks.map(week => {
    const originalDateInWeek = dateInWeek(task.originalDateStr, week);
    const newDateInWeek = dateInWeek(task.newDateStr, week);

    let cellContent = '';
    if (originalDateInWeek) {
      cellContent = '<div class="bar-yellow"></div>';
    } else if (newDateInWeek) {
      cellContent = '<div class="bar-green"></div>';
    }

    return `<td class="week-cell">${cellContent}</td>`;
  }).join('')}
            </tr>`).join('')}
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
</html>`;
}

/**
 * Save HTML to a file
 * @param {string} html - HTML content
 * @param {string} filePath - Output file path
 * @returns {string} File path
 */
function saveHtmlToFile(html, filePath) {
  fs.writeFileSync(filePath, html);
  return filePath;
}

/**
 * Try to open the HTML file in the default browser
 * @param {string} filePath - Path to HTML file
 * @returns {boolean} True if browser opened successfully
 */
function openInBrowser(filePath) {
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

/**
 * Process a single CSV file and generate HTML
 * @param {string} inputFilePath - Input CSV file path
 * @param {string} outputFilePath - Output HTML file path
 * @returns {string|null} Output file path or null if error
 */
function processCSVFile(inputFilePath, outputFilePath) {
  try {
    // Check if input file exists
    if (!fs.existsSync(inputFilePath)) {
      console.error(`Input file does not exist: ${inputFilePath}`);
      return null;
    }

    console.log(`\nProcessing file: ${inputFilePath}`);
    console.log(`Output will be saved to: ${outputFilePath}`);

    // Read and parse CSV file
    console.log(`Reading CSV file...`);
    const csvContent = fs.readFileSync(inputFilePath, 'utf8');
    console.log('Parsing CSV data...');
    const tasks = parseCSV(csvContent);
    console.log(`\nSuccessfully parsed ${tasks.length} tasks`);

    if (tasks.length === 0) {
      console.warn('No valid tasks found in the CSV file.');
      return null;
    }

    // Find overall date range
    const allDates = tasks.flatMap(task => [task.originalDate, task.newDate]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    // Add buffer to the date range (2 weeks on each side)
    const startDate = new Date(minDate);
    startDate.setDate(startDate.getDate() - 14);

    const endDate = new Date(maxDate);
    endDate.setDate(endDate.getDate() + 14);

    console.log('Generating chart for date range:');
    console.log(`Start: ${formatFullDate(startDate)}`);
    console.log(`End: ${formatFullDate(endDate)}`);

    // Get all weeks in the date range and group by month
    const weeks = getWeeks(startDate, endDate);
    console.log(`Generated ${weeks.length} weeks`);
    const months = groupWeeksByMonth(weeks);
    console.log(`Spanning ${months.length} months`);

    // Generate HTML and save to file
    console.log('Generating PowerPoint-optimized chart...');
    const htmlContent = generatePowerPointHTML(tasks, months);

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputFilePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created output directory: ${outputDir}`);
    }

    console.log(`Saving HTML to: ${outputFilePath}`);
    saveHtmlToFile(htmlContent, outputFilePath);

    return outputFilePath;
  } catch (error) {
    console.error(`Error processing ${inputFilePath}: ${error.message}`);
    return null;
  }
}

/**
 * Process all CSV files in a directory
 * @param {string} inputDir - Input directory path
 * @param {string} outputDir - Output directory path
 * @returns {Array} Array of processed file objects
 */
function processDirectory(inputDir, outputDir) {
  try {
    console.log(`Processing all CSV files in directory: ${inputDir}`);
    console.log(`Output will be saved to directory: ${outputDir}`);

    // Check if input directory exists
    if (!fs.existsSync(inputDir)) {
      console.error(`Input directory does not exist: ${inputDir}`);
      process.exit(1);
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created output directory: ${outputDir}`);
    }

    // Get all CSV files in input directory
    const files = fs.readdirSync(inputDir).filter(file =>
      file.toLowerCase().endsWith('.csv')
    );

    if (files.length === 0) {
      console.warn(`No CSV files found in directory: ${inputDir}`);
      process.exit(0);
    }

    console.log(`Found ${files.length} CSV files to process`);

    // Process each CSV file
    const results = [];

    for (const file of files) {
      const inputFilePath = path.join(inputDir, file);
      const outputFileName = path.basename(file, path.extname(file)) + '.html';
      const outputFilePath = path.join(outputDir, outputFileName);

      const result = processCSVFile(inputFilePath, outputFilePath);
      if (result) {
        results.push({
          input: inputFilePath,
          output: result
        });
      }
    }

    // Print summary
    console.log('\n=== Processing Summary ===');
    console.log(`Successfully processed ${results.length} of ${files.length} files`);

    // Open the first HTML file in the browser if any were successfully generated
    if (results.length > 0) {
      console.log('\nOpening first HTML file in browser...');
      openInBrowser(results[0].output);

      console.log('\nAll HTML files:');
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.output}`);
      });
    }

    return results;
  } catch (error) {
    console.error(`Error processing directory: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 * @returns {Object} Object with inputPath, outputPath and mode properties
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('\nERROR: No input specified.');
    console.error('Usage:');
    console.error('  For single file: node tasks-chart.js input.csv [output.html]');
    console.error('  For directory:   node tasks-chart.js input-dir [output-dir]');
    process.exit(1);
  }

  const inputPath = args[0];
  let outputPath = args[1];

  // Check if input path exists
  if (!fs.existsSync(inputPath)) {
    console.error(`\nERROR: Input path does not exist: ${inputPath}`);
    process.exit(1);
  }

  // Determine if input is file or directory
  const isDirectory = fs.statSync(inputPath).isDirectory();

  // Set defaults and validate
  if (isDirectory) {
    // For directory mode
    const inputDir = inputPath;
    const outputDir = outputPath || 'output';

    // Count CSV files in directory
    const csvFiles = fs.readdirSync(inputDir).filter(file =>
      file.toLowerCase().endsWith('.csv')
    );

    if (csvFiles.length === 0) {
      console.error(`\nERROR: No CSV files found in directory: ${inputDir}`);
      console.error('Please ensure there are CSV files in the input directory.');
      process.exit(1);
    }

    return {
      inputPath: inputDir,
      outputPath: outputDir,
      mode: 'directory'
    };
  } else {
    // For single file mode
    const inputFile = inputPath;

    // Default output is input filename with .html extension
    if (!outputPath) {
      const inputBasename = path.basename(inputFile, path.extname(inputFile));
      outputPath = `${inputBasename}.html`;
    }

    return {
      inputPath: inputFile,
      outputPath: outputPath,
      mode: 'file'
    };
  }
}

/**
 * Main function
 */
function main() {
  const { inputPath, outputPath, mode } = parseArgs();

  console.log('=== Schedule Changes HTML Generator ===');

  if (mode === 'directory') {
    console.log(`Input directory: ${inputPath}`);
    console.log(`Output directory: ${outputPath}`);
    processDirectory(inputPath, outputPath);
  } else {
    console.log(`Input file: ${inputPath}`);
    console.log(`Output file: ${outputPath}`);
    const result = processCSVFile(inputPath, outputPath);

    if (result) {
      console.log('\nHTML file generated successfully!');
      openInBrowser(result);
    } else {
      console.error('\nFailed to generate HTML file.');
      process.exit(1);
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
} else {
  // Export for use in other modules
  module.exports = {
    processCSVFile,
    processDirectory,
    parseCSV,
    getWeeks,
    groupWeeksByMonth
  };
}