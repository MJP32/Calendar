// tasks-chart.js - Improved task name formatting with purple box for same-week dates
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

// Parse CSV data into task objects
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
      name: formatTaskName(taskName),
      originalName: taskName, // Keep original for tooltip
      originalDate,
      newDate
    });
  }

  return tasks;
}

// Format task name for better display
function formatTaskName(taskName) {
  if (!taskName) return '';

  // Capitalize first letter of each word
  let formattedName = taskName.replace(/\b\w/g, c => c.toUpperCase());

  // Improve formatting for common abbreviations
  const abbreviations = {
    'Qa': 'QA',
    'Api': 'API',
    'Ui': 'UI',
    'Ux': 'UX',
    'Ci/cd': 'CI/CD',
    'Ci': 'CI',
    'Cd': 'CD',
    'Db': 'DB'
  };

  // Replace abbreviations
  Object.entries(abbreviations).forEach(([abbr, replacement]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, 'g');
    formattedName = formattedName.replace(regex, replacement);
  });

  // Remove redundant spaces
  formattedName = formattedName.replace(/\s+/g, ' ').trim();

  return formattedName;
}

// Parse a CSV line handling quoted values
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

// Parse date string in multiple formats
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

// Format date for display (MM/DD)
function formatDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Format full date for console output (MM/DD/YYYY)
function formatFullDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

// Format date as MM/DD/YYYY for exact comparison
function formatDetailedDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

// Check if two dates are in the same week
function datesInSameWeek(date1, date2) {
  // Clone dates to not modify originals
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  // Set to start of day
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);

  // Get the day of the week (0-6, where 0 is Sunday)
  const day1 = d1.getDay();
  const day2 = d2.getDay();

  // Set to the start of their respective weeks (Sunday)
  d1.setDate(d1.getDate() - day1);
  d2.setDate(d2.getDate() - day2);

  // Compare start of week
  return d1.getTime() === d2.getTime();
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

// Generate HTML for the tasks chart
function generatePowerPointHTML(tasks, months) {
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
    newDateStr: formatDetailedDate(task.newDate),
    sameWeek: datesInSameWeek(task.originalDate, task.newDate)
  }));

  // Generate HTML content
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Schedule Changes</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      margin: 20px; 
      padding: 0;
    }
    
    h1 { 
      color: #2c5282; 
      font-size: 48px;
      text-align: center;
    }
    
    .subtitle {
      color: #4a5568;
      font-size: 28px;
      text-align: center;
      margin-bottom: 30px;
    }
    
    table { 
      border-collapse: collapse; 
      width: 100%;
      margin-bottom: 20px;
    }
    
    td, th {
      border: 1px solid #cbd5e0;
      padding: 10px;
      text-align: center;
    }
    
    th { 
      background-color: #4299e1;
      color: white; 
    }
    
    th.task-cell { 
      color: black; 
    }
    
    .task-cell { 
      text-align: left; 
      background-color: #ebf8ff;
      width: 450px;
      padding: 10px;
    }
    
    .task-name {
      font-size: 18px;
      font-weight: 600;
      color: #2c5282;
      margin-bottom: 5px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      max-width: 430px;
      display: block;
    }
    
    .week-cell {
      width: 70px;
    }
    
    tr:nth-child(even) { 
      background-color: #ebf8ff; 
    }
    
    tr:nth-child(odd) { 
      background-color: #f7fafc; 
    }
    
    .bar-yellow { 
      background-color: #ecc94b;
      height: 24px; 
      border: 1px solid #d69e2e;
      width: 100%;
    }
    
    .bar-green { 
      background-color: #48bb78;
      height: 24px; 
      border: 1px solid #2f855a;
      width: 100%;
    }
    
    .bar-purple { 
      background-color: #9f7aea;
      height: 24px; 
      border: 1px solid #805ad5;
      width: 100%;
    }
    
    .date-info { 
      font-size: 14px; 
      color: #718096;
      border-top: 1px dotted #cbd5e0;
      padding-top: 5px;
      margin-top: 5px;
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
      font-size: 20px;
    }
    
    .legend-color { 
      width: 24px; 
      height: 24px; 
      margin-right: 12px;
    }
    
    @media print {
      body {
        padding: 0;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <h1>Schedule Changes</h1>
  <div class="subtitle">${titleDateRange}</div>
  
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

  // Add task rows with improved formatting
  formattedTasks.forEach(task => {
    html += `
      <tr>
        <td class="task-cell">
          <span class="task-name" title="${task.originalName}">${task.name}</span>
          <div class="date-info">${formatDate(task.originalDate)} - ${formatDate(task.newDate)}</div>
        </td>
`;

    // Add task cells
    allWeeks.forEach(week => {
      const originalDateInWeek = dateInWeek(task.originalDateStr, week);
      const newDateInWeek = dateInWeek(task.newDateStr, week);

      let cellContent = '';
      if (originalDateInWeek && newDateInWeek && task.sameWeek) {
        // Both dates are in the same week - use purple
        cellContent = '<div class="bar-purple"></div>';
      } else if (originalDateInWeek) {
        cellContent = '<div class="bar-yellow"></div>';
      } else if (newDateInWeek) {
        cellContent = '<div class="bar-green"></div>';
      }

      html += `<td class="week-cell">${cellContent}</td>`;
    });

    html += `
      </tr>`;
  });

  html += `
    </tbody>
  </table>
  
  <div class="legend">
    <div class="legend-item">
      <div class="legend-color bar-yellow"></div>
      <span>Original Date</span>
    </div>
    <div class="legend-item">
      <div class="legend-color bar-green"></div>
      <span>Completion Date</span>
    </div>
    <div class="legend-item">
      <div class="legend-color bar-purple"></div>
      <span>Same Week</span>
    </div>
  </div>
</body>
</html>`;

  return html;
}

// Save HTML to a file
function saveHtmlToFile(html, filePath) {
  fs.writeFileSync(filePath, html);
  return filePath;
}

// Try to open the HTML file in the default browser
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

// Process a single CSV file and generate HTML
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

// Process all CSV files in a directory
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

// Parse command line arguments
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

// Main function
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