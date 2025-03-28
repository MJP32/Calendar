// tasks-chart.js - Fixed version without React JSX
const fs = require('fs');
const path = require('path');

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

// Generate HTML for the tasks chart - Fixed for Node.js
function generateTasksChartHTML(tasks, months) {
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

  // Generate interactive chart HTML
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
      width: 1600px;
      height: 900px;
      overflow: hidden;
      position: relative;
      padding: 20px;
    }
    
    .chart-container { 
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    
    h1 { 
      color: #2b6cb0; 
      font-size: 36px;
      margin: 0 0 10px 0;
      text-align: center;
    }
    
    .subtitle {
      color: #4a5568;
      font-size: 22px;
      margin: 0 0 20px 0;
      text-align: center;
    }
    
    table { 
      border-collapse: collapse; 
      width: 100%;
      font-size: 16px;
      table-layout: fixed;
    }
    
    th, td { 
      border: 1px solid #cbd5e0; 
      padding: 6px; 
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
      position: sticky; 
      left: 0; 
      background: inherit;
      width: 200px;
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .week-cell {
      width: 64px; /* Fixed width for week cells */
    }
    
    tr:nth-child(even) { background-color: #f0f7ff; }
    tr:nth-child(odd) { background-color: #ffffff; }
    
    .bar-yellow { 
      background-color: #ecc94b; 
      border-radius: 3px; 
      height: 20px; 
      border: 1px solid #d69e2e;
      width: 100%;
    }
    
    .bar-green { 
      background-color: #48bb78; 
      border-radius: 3px; 
      height: 20px; 
      border: 1px solid #2f855a;
      width: 100%;
    }
    
    /* Interactive features */
    .task-row:hover {
      background-color: #e5f0ff !important;
    }
    
    .tooltip {
      display: none;
      position: absolute;
      background-color: #fff;
      border: 1px solid #ddd;
      padding: 10px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 100;
      max-width: 250px;
    }
    
    .task-cell:hover .tooltip,
    td:hover .tooltip {
      display: block;
    }
    
    .legend { 
      display: flex; 
      gap: 30px; 
      justify-content: center; 
      margin-top: 15px; 
    }
    
    .legend-item { 
      display: flex; 
      align-items: center;
      font-size: 18px;
    }
    
    .legend-color { 
      width: 20px; 
      height: 20px; 
      border-radius: 3px; 
      margin-right: 8px; 
    }
    
    .date-info { 
      font-size: 12px; 
      color: #666; 
    }
  </style>
  <script>
    // Simple JavaScript for interactivity
    document.addEventListener('DOMContentLoaded', function() {
      // Add hover functionality
      const taskCells = document.querySelectorAll('.task-cell');
      
      taskCells.forEach(cell => {
        cell.addEventListener('mouseenter', function() {
          const taskId = this.getAttribute('data-task-id');
          const row = document.querySelector(\`tr[data-task-id="\${taskId}"]\`);
          if (row) {
            row.classList.add('highlight');
          }
        });
        
        cell.addEventListener('mouseleave', function() {
          const taskId = this.getAttribute('data-task-id');
          const row = document.querySelector(\`tr[data-task-id="\${taskId}"]\`);
          if (row) {
            row.classList.remove('highlight');
          }
        });
      });
    });
  </script>
</head>
<body>
  <div class="slide-container">
    <h1>Schedule Changes</h1>
    <div class="subtitle">${titleDateRange}</div>
    <div class="chart-container">
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
          <tr class="task-row" data-task-id="${taskIndex}">
            <td class="task-cell" data-task-id="${taskIndex}">
              <div title="${task.name}">${task.name}</div>
              <div class="date-info">${formatDate(task.originalDate)} - ${formatDate(task.newDate)}</div>
              <div class="tooltip">
                <strong>${task.name}</strong><br>
                Original Date: ${formatFullDate(task.originalDate)}<br>
                Completion Date: ${formatFullDate(task.newDate)}<br>
                Duration: ${Math.round((task.newDate - task.originalDate) / (1000 * 60 * 60 * 24))} days
              </div>
            </td>
    `;

    // Add task cells - ONLY for start and end dates, NO in-between
    allWeeks.forEach(week => {
      // Check if original or completion date falls in this week
      const originalDateInWeek = dateInWeek(task.originalDateStr, week);
      const newDateInWeek = dateInWeek(task.newDateStr, week);

      let cellContent = '';
      let tooltipContent = '';

      // Show yellow bar ONLY for original date weeks
      if (originalDateInWeek) {
        cellContent = `<div class="bar-yellow"></div>`;
        tooltipContent = `<div class="tooltip">${task.name}<br>Original Date: ${formatFullDate(task.originalDate)}</div>`;
      }
      // Show green bar ONLY for completion date weeks
      else if (newDateInWeek) {
        cellContent = `<div class="bar-green"></div>`;
        tooltipContent = `<div class="tooltip">${task.name}<br>Completion Date: ${formatFullDate(task.newDate)}</div>`;
      }
      // Leave all other cells empty - NO in-progress bars

      html += `<td class="week-cell">${cellContent}${tooltipContent}</td>`;
    });

    html += `</tr>`;
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
      </div>
    </div>
  </div>
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

// Main function to process CSV and generate chart
function processCSVAndGenerateChart(inputFilePath, outputFilePath) {
  try {
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

    // Generate HTML chart with interactivity
    console.log('\nGenerating interactive chart...');
    const htmlContent = generateTasksChartHTML(tasks, months);

    // Save to temp HTML file
    const tempHtmlPath = path.join(process.cwd(), 'temp_chart.html');
    saveHtmlToFile(htmlContent, tempHtmlPath);
    console.log(`\nHTML chart saved to: ${tempHtmlPath}`);

    // If output is HTML, we're done
    if (outputFilePath.toLowerCase().endsWith('.html')) {
      fs.copyFileSync(tempHtmlPath, outputFilePath);
      console.log(`HTML chart also saved to: ${outputFilePath}`);
      return tempHtmlPath;
    }

    return tempHtmlPath;

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node tasks-chart.js <input-csv-file> [output-file]');
    console.error('Example: node tasks-chart.js tasks.csv chart.jpg');
    process.exit(1);
  }

  const inputFilePath = args[0];
  let outputFilePath = args[1];

  // If no output file specified, generate one based on input file
  if (!outputFilePath) {
    outputFilePath = path.join(
      path.dirname(inputFilePath),
      `${path.basename(inputFilePath, path.extname(inputFilePath))}_chart.jpg`
    );
  }

  return { inputFilePath, outputFilePath };
}

// Run the script if called directly
if (require.main === module) {
  const { inputFilePath, outputFilePath } = parseArgs();
  processCSVAndGenerateChart(inputFilePath, outputFilePath);
} else {
  // Export for use in other modules
  module.exports = {
    processCSVAndGenerateChart,
    parseCSV,
    getWeeks,
    groupWeeksByMonth
  };
}