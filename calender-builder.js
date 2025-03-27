const fs = require('fs');
const path = require('path');

// Function to parse CSV data
function parseCSV(csvContent) {
  // Simple CSV parser (for more complex CSVs, you might want to use a library like csv-parse)
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
      
      if (char === '"' && (j === 0 || line[j-1] !== '\\')) {
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
    
    // Parse dates - add time component to ensure proper comparison
    let originalDate = new Date(originalDateStr);
    let newDate = new Date(newDateStr);
    
    // Try alternative date formats if standard parsing fails
    if (isNaN(originalDate.getTime()) && originalDateStr.includes('/')) {
      const parts = originalDateStr.split('/');
      if (parts.length >= 3) {
        originalDate = new Date(
          parseInt(parts[2]), // Year
          parseInt(parts[0]) - 1, // Month (0-indexed)
          parseInt(parts[1]) // Day
        );
      }
    }
    
    if (isNaN(newDate.getTime()) && newDateStr.includes('/')) {
      const parts = newDateStr.split('/');
      if (parts.length >= 3) {
        newDate = new Date(
          parseInt(parts[2]), // Year
          parseInt(parts[0]) - 1, // Month (0-indexed)
          parseInt(parts[1]) // Day
        );
      }
    }
    
    // Set dates to beginning and end of day to ensure inclusivity
    if (!isNaN(originalDate.getTime())) {
      originalDate = new Date(originalDate.setHours(0, 0, 0, 0));
    }
    
    if (!isNaN(newDate.getTime())) {
      newDate = new Date(newDate.setHours(23, 59, 59, 999));
    }
    
    if (isNaN(originalDate.getTime()) || isNaN(newDate.getTime())) {
      console.warn(`Skipping row ${i}: Invalid date format for task "${taskName}"`);
      continue;
    }
    
    tasks.push({
      name: taskName,
      startDate: originalDate,
      endDate: newDate
    });
  }
  
  return tasks;
}

// Function to get months and weeks between dates
function generateTimeframe(tasks) {
  if (tasks.length === 0) return [];
  
  // Find min and max dates
  const dates = tasks.flatMap(task => [task.startDate, task.endDate]);
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  
  // Adjust to start of month
  const startMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  
  // Adjust to end of month
  const endMonth = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
  
  const months = [];
  let currentDate = new Date(startMonth);
  
  while (currentDate <= endMonth) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' });
    
    // Calculate weeks in this month
    const weeksInMonth = getWeeksInMonth(year, month);
    
    months.push({
      name: `${monthName} ${year}`,
      year,
      month,
      weeks: weeksInMonth
    });
    
    // Move to next month
    currentDate = new Date(year, month + 1, 1);
  }
  
  return months;
}

// Get weeks in a month (ending on Saturdays)
function getWeeksInMonth(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Set times to start and end of day for inclusive comparisons
  firstDay.setHours(0, 0, 0, 0);
  lastDay.setHours(23, 59, 59, 999);
  
  // Get weeks array
  const weeks = [];
  let weekCounter = 1;
  
  // Find first Saturday
  let currentDate = new Date(firstDay);
  
  // If not Saturday, move to nearest Saturday
  if (currentDate.getDay() !== 6) {
    const daysUntilSaturday = (6 - currentDate.getDay()) % 7;
    currentDate.setDate(currentDate.getDate() + daysUntilSaturday);
  }
  
  // Make sure we set the time component to end of day for the Saturday
  currentDate.setHours(23, 59, 59, 999);
  
  // Add weeks until we reach end of month
  while (currentDate <= lastDay) {
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - 6); // Go back to Sunday
    weekStart.setHours(0, 0, 0, 0); // Start of day for Sunday
    
    // Only include if week start is in current month or first day of month
    if (weekStart.getMonth() === month || weekStart.getDate() === 1) {
      weeks.push({
        number: weekCounter,
        start: new Date(weekStart),
        end: new Date(currentDate) // This is the Saturday at end of day
      });
    }
    
    weekCounter++;
    currentDate.setDate(currentDate.getDate() + 7);
    currentDate.setHours(23, 59, 59, 999); // Ensure end of day
  }
  
  return weeks;
}

// Check if a task falls within a specific week - improved for inclusivity
function taskInWeek(task, weekStart, weekEnd) {
  const taskStart = new Date(task.startDate);
  const taskEnd = new Date(task.endDate);
  
  // Ensure time components are set for proper comparison
  weekStart.setHours(0, 0, 0, 0); // Start of day
  weekEnd.setHours(23, 59, 59, 999); // End of day
  
  // Enhanced check for inclusivity:
  // Task starts on or before week ends AND task ends on or after week starts
  return taskStart <= weekEnd && taskEnd >= weekStart;
}

// Format date for display
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric'
  });
}

// Get week label
function getWeekLabel(week) {
  return `${formatDate(week.start)}-${formatDate(week.end)}`;
}

// Generate HTML for the tasks chart
function generateTasksChartHTML(tasks, timeframe) {
  let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Tasks Chart</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .chart-container { overflow-x: auto; background: white; border: 1px solid #ddd; border-radius: 5px; padding: 15px; }
    h1, h2 { color: #2b6cb0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
    th { background-color: #4299e1; color: white; }
    .task-cell { text-align: left; font-weight: 500; position: sticky; left: 0; background: inherit; }
    tr:nth-child(even) { background-color: #f0f7ff; }
    .bar-yellow { background-color: #ecc94b; border-radius: 3px; height: 20px; }
    .bar-green { background-color: #48bb78; border-radius: 3px; height: 20px; }
    .bar-blue { background-color: #bee3f8; border-radius: 3px; height: 20px; }
    .legend { display: flex; gap: 15px; justify-content: center; margin-top: 15px; }
    .legend-item { display: flex; align-items: center; }
    .legend-color { width: 16px; height: 16px; border-radius: 3px; margin-right: 8px; }
    .date-info { font-size: 11px; color: #666; }
  </style>
</head>
<body>
  <h1>Tasks Chart</h1>
  <div class="chart-container">
    <table>
      <thead>
        <tr>
          <th>Task</th>
  `;
  
  // Add month headers
  timeframe.forEach(month => {
    html += `<th colspan="${month.weeks.length}">${month.name}</th>`;
  });
  
  html += `
        </tr>
        <tr>
          <th>Start - End</th>
  `;
  
  // Add week headers
  timeframe.forEach(month => {
    month.weeks.forEach(week => {
      html += `<th>W${week.number}<br><span class="date-info">${getWeekLabel(week)}</span></th>`;
    });
  });
  
  html += `
        </tr>
      </thead>
      <tbody>
  `;
  
  // Add task rows
  tasks.forEach((task, taskIndex) => {
    html += `
        <tr>
          <td class="task-cell">
            <div>${task.name}</div>
            <div class="date-info">${formatDate(task.startDate)} - ${formatDate(task.endDate)}</div>
          </td>
    `;
    
    // Add task cells
    timeframe.forEach(month => {
      month.weeks.forEach(week => {
        const inWeek = taskInWeek(task, week.start, week.end);
        
        // Determine bar type based on dates
        let barClass = '';
        if (inWeek) {
          const weekMiddle = new Date((week.start.getTime() + week.end.getTime()) / 2);
          
          // Check if this week contains the start date (with precision)
          const isStartWeek = week.start <= task.startDate && task.startDate <= week.end;
          // Check if this week contains the end date (with precision)
          const isEndWeek = week.start <= task.endDate && task.endDate <= week.end;
          
          if (isStartWeek) {
            barClass = 'bar-yellow'; // Original date - yellow
          } else if (isEndWeek) {
            barClass = 'bar-green'; // New date - green
          } else {
            barClass = 'bar-blue'; // Middle weeks - light blue
          }
        }
        
        html += `<td>${inWeek ? `<div class="${barClass}"></div>` : ''}</td>`;
      });
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
        <span>New Date (Completion)</span>
      </div>
    </div>
  </div>
</body>
</html>
  `;
  
  return html;
}

// Main function to process CSV and generate chart
function processCSVAndGenerateChart(inputFilePath, outputFilePath) {
  try {
    console.log(`Reading CSV file: ${inputFilePath}`);
    const csvContent = fs.readFileSync(inputFilePath, 'utf8');
    
    console.log('Parsing CSV data...');
    const tasks = parseCSV(csvContent);
    console.log(`Successfully parsed ${tasks.length} tasks`);
    
    console.log('Generating timeframe...');
    const timeframe = generateTimeframe(tasks);
    
    console.log('Generating HTML chart...');
    const htmlContent = generateTasksChartHTML(tasks, timeframe);
    
    console.log(`Writing output to: ${outputFilePath}`);
    fs.writeFileSync(outputFilePath, htmlContent);
    
    console.log('Chart generated successfully!');
    console.log(`Open ${outputFilePath} in your web browser to view the chart.`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node tasks-chart.js <input-csv-file> [output-html-file]');
    console.error('Example: node tasks-chart.js tasks.csv chart.html');
    process.exit(1);
  }
  
  const inputFilePath = args[0];
  const outputFilePath = args[1] || path.join(
    path.dirname(inputFilePath),
    `${path.basename(inputFilePath, path.extname(inputFilePath))}_chart.html`
  );
  
  return { inputFilePath, outputFilePath };
}

// Run the script
const { inputFilePath, outputFilePath } = parseArgs();
processCSVAndGenerateChart(inputFilePath, outputFilePath);
