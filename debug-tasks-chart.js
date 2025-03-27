const fs = require('fs');
const path = require('path');

// Function to parse CSV data with debugging
function parseCSV(csvContent) {
  // Simple CSV parser (for more complex CSVs, you might want to use a library like csv-parse)
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  console.log('CSV Headers:', headers);
  
  const taskNameIndex = headers.findIndex(h => h.toLowerCase().includes('task name'));
  const origDateIndex = headers.findIndex(h => h.toLowerCase().includes('original date'));
  const newDateIndex = headers.findIndex(h => h.toLowerCase().includes('new date'));
  
  console.log('Column indices - Task Name:', taskNameIndex, 'Original Date:', origDateIndex, 'New Date:', newDateIndex);
  
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
    
    // Check for DevOps Knowledge Transfer task specifically
    const isDevOpsTask = taskName.includes('DevOps Knowledge Transfer');
    if (isDevOpsTask) {
      console.log('Found DevOps Knowledge Transfer task:');
      console.log('  Original date string:', originalDateStr);
      console.log('  New date string:', newDateStr);
    }
    
    // Parse dates
    const originalDate = new Date(originalDateStr);
    const newDate = new Date(newDateStr);
    
    if (isDevOpsTask) {
      console.log('  Parsed original date:', originalDate.toISOString());
      console.log('  Parsed new date:', newDate.toISOString());
      console.log('  Valid original date?', !isNaN(originalDate.getTime()));
      console.log('  Valid new date?', !isNaN(newDate.getTime()));
    }
    
    if (isNaN(originalDate.getTime()) || isNaN(newDate.getTime())) {
      console.warn(`Skipping row ${i}: Invalid date format for task "${taskName}"`);
      console.warn(`  Original date: "${originalDateStr}" - Valid: ${!isNaN(originalDate.getTime())}`);
      console.warn(`  New date: "${newDateStr}" - Valid: ${!isNaN(newDate.getTime())}`);
      continue;
    }
    
    tasks.push({
      name: taskName,
      startDate: originalDate,
      endDate: newDate
    });
    
    if (isDevOpsTask) {
      console.log('  Successfully added DevOps Knowledge Transfer task to tasks array');
    }
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
  
  console.log('Date range for chart:');
  console.log('  Min date:', minDate.toISOString());
  console.log('  Max date:', maxDate.toISOString());
  
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
  
  // Add weeks until we reach end of month
  while (currentDate <= lastDay) {
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - 6); // Go back to Sunday
    
    // Only include if week start is in current month or first day of month
    if (weekStart.getMonth() === month || weekStart.getDate() === 1) {
      weeks.push({
        number: weekCounter,
        start: new Date(weekStart),
        end: new Date(currentDate)
      });
    }
    
    weekCounter++;
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return weeks;
}

// Check if a task falls within a specific week with improved debugging
function taskInWeek(task, weekStart, weekEnd, isDebugTask = false) {
  const taskStart = new Date(task.startDate);
  const taskEnd = new Date(task.endDate);
  
  // Task starts before week ends AND task ends after week starts
  const result = taskStart <= weekEnd && taskEnd >= weekStart;
  
  if (isDebugTask) {
    console.log('Task-Week Overlap Check:');
    console.log(`  Week: ${weekStart.toLocaleDateString()} to ${weekEnd.toLocaleDateString()}`);
    console.log(`  Task start: ${taskStart.toLocaleDateString()}`);
    console.log(`  Task end: ${taskEnd.toLocaleDateString()}`);
    console.log(`  Task in week? ${result}`);
    console.log(`  taskStart <= weekEnd? ${taskStart <= weekEnd}`);
    console.log(`  taskEnd >= weekStart? ${taskEnd >= weekStart}`);
  }
  
  return result;
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
  // Check if DevOps Knowledge Transfer task exists
  const devOpsTask = tasks.find(task => task.name.includes('DevOps Knowledge Transfer'));
  if (devOpsTask) {
    console.log('DevOps Knowledge Transfer task found in tasks array:');
    console.log('  Start date:', devOpsTask.startDate.toISOString());
    console.log('  End date:', devOpsTask.endDate.toISOString());
  } else {
    console.log('DevOps Knowledge Transfer task NOT found in tasks array');
  }
  
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
    const isDevOpsTask = task.name.includes('DevOps Knowledge Transfer');
    
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
        const inWeek = taskInWeek(task, week.start, week.end, isDevOpsTask);
        
        // Determine bar type based on dates
        let barClass = '';
        if (inWeek) {
          const weekMiddle = new Date((week.start.getTime() + week.end.getTime()) / 2);
          
          if (isDevOpsTask) {
            console.log(`Week middle: ${weekMiddle.toLocaleDateString()}`);
            console.log(`Task start + 1 day: ${new Date(task.startDate.getTime() + (24 * 60 * 60 * 1000)).toLocaleDateString()}`);
            console.log(`Is start date week? ${weekMiddle.getTime() <= task.startDate.getTime() + (24 * 60 * 60 * 1000)}`);
            console.log(`Task end - 1 day: ${new Date(task.endDate.getTime() - (24 * 60 * 60 * 1000)).toLocaleDateString()}`);
            console.log(`Is end date week? ${weekMiddle.getTime() >= task.endDate.getTime() - (24 * 60 * 60 * 1000)}`);
          }
          
          if (weekMiddle.getTime() <= task.startDate.getTime() + (24 * 60 * 60 * 1000)) {
            barClass = 'bar-yellow'; // Original date - yellow
            if (isDevOpsTask) console.log('Setting yellow bar for DevOps task original date');
          } else if (weekMiddle.getTime() >= task.endDate.getTime() - (24 * 60 * 60 * 1000)) {
            barClass = 'bar-green'; // New date - green
            if (isDevOpsTask) console.log('Setting green bar for DevOps task new date');
          } else {
            barClass = 'bar-blue'; // Middle weeks - light blue
            if (isDevOpsTask) console.log('Setting blue bar for DevOps task intermediate period');
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
