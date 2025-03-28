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

// Generate HTML for the tasks chart optimized for PowerPoint
function generateTasksChartHTML(tasks, timeframe) {
  // Calculate title based on date range
  const allDates = tasks.flatMap(task => [task.startDate, task.endDate]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const titleDateRange = `${formatDate(minDate)} - ${formatDate(maxDate)}`;

  let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Project Timeline</title>
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
    
    tr:nth-child(even) { background-color: #f0f7ff; }
    tr:nth-child(odd) { background-color: #ffffff; }
    
    .bar-yellow { 
      background-color: #ecc94b; 
      border-radius: 3px; 
      height: 20px; 
      border: 1px solid #d69e2e;
    }
    
    .bar-green { 
      background-color: #48bb78; 
      border-radius: 3px; 
      height: 20px; 
      border: 1px solid #2f855a;
    }
    
    .bar-blue { 
      background-color: #bee3f8; 
      border-radius: 3px; 
      height: 20px; 
      border: 1px solid #63b3ed;
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
</head>
<body>
  <div class="slide-container">
    <h1>Project Timeline</h1>
    <div class="subtitle">${titleDateRange}</div>
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

  // Add week headers - simplified for PowerPoint
  timeframe.forEach(month => {
    month.weeks.forEach(week => {
      html += `<th>W${week.number}</th>`;
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
            <td class="task-cell" title="${task.name}">
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
          // Check if this week contains the start date
          const isStartWeek = week.start <= task.startDate && task.startDate <= week.end;
          // Check if this week contains the end date
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

// Save HTML to a temporary file
async function saveHtmlToTemp(html) {
  const tempFile = path.join(process.cwd(), 'temp_ppt_chart.html');
  await fs.promises.writeFile(tempFile, html);
  return tempFile;
}

// Instructions for using with PowerPoint
async function generatePowerPointInstructions(htmlPath, outputPath) {
  console.log('\n===== POWERPOINT INSTRUCTIONS =====');
  console.log('To use this chart in PowerPoint:');
  console.log('\nOption 1: Screenshot method');
  console.log('1. Open the HTML file in a web browser by typing:');
  console.log(`   file://${htmlPath}`);
  console.log('2. Take a screenshot (press Alt+PrtScn on Windows or Cmd+Shift+4 on Mac)');
  console.log('3. Paste the screenshot into your PowerPoint slide');
  console.log('\nOption 2: Save as image and insert');
  console.log('1. Open the HTML file in a browser');
  console.log('2. Right-click and select "Save as..." or press Ctrl+S');
  console.log('3. Save as a JPEG or PNG file');
  console.log('4. In PowerPoint, select Insert > Pictures > From File');
  console.log('5. Browse to and select your saved image file');
  console.log('\nOption 3: If you have Puppeteer installed:');
  console.log('Run: npm install puppeteer');
  console.log('Then run the script with the --puppeteer flag:');
  console.log(`node tasks-chart.js ${path.basename(outputPath.replace('.jpg', '.csv'))} ${path.basename(outputPath)} --puppeteer`);
  console.log('\n====================================');

  return htmlPath;
}

// Check if puppeteer flag is present
const usePuppeteer = process.argv.includes('--puppeteer');

// Convert HTML to JPEG using Puppeteer if available
async function convertHtmlToJpeg(htmlPath, outputPath) {
  if (!usePuppeteer) {
    return await generatePowerPointInstructions(htmlPath, outputPath);
  }

  try {
    // Try to require puppeteer
    const puppeteer = require('puppeteer');

    console.log('Using Puppeteer to generate JPEG image...');

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });

    // Set viewport to PowerPoint 16:9 dimensions
    await page.setViewport({
      width: 1600,
      height: 900,
      deviceScaleFactor: 1
    });

    // Take screenshot of the slide container
    await page.screenshot({
      path: outputPath,
      type: 'jpeg',
      quality: 100,
      fullPage: false
    });

    await browser.close();
    console.log('JPEG image saved to:', outputPath);
    console.log('This image is optimized for PowerPoint slides (16:9 aspect ratio)');

    return outputPath;
  } catch (error) {
    console.log('Puppeteer not available or error occurred:', error.message);
    return await generatePowerPointInstructions(htmlPath, outputPath);
  }
}

// Main function to process CSV and generate chart
async function processCSVAndGenerateChart(inputFilePath, outputFilePath) {
  try {
    console.log(`Reading CSV file: ${inputFilePath}`);
    const csvContent = fs.readFileSync(inputFilePath, 'utf8');

    console.log('Parsing CSV data...');
    const tasks = parseCSV(csvContent);
    console.log(`Successfully parsed ${tasks.length} tasks`);

    console.log('Generating timeframe...');
    const timeframe = generateTimeframe(tasks);

    console.log('Generating PowerPoint-optimized chart...');
    const htmlContent = generateTasksChartHTML(tasks, timeframe);

    // Save temporary HTML file
    const tempHtmlPath = await saveHtmlToTemp(htmlContent);
    console.log(`Temporary HTML file saved to: ${tempHtmlPath}`);

    // Convert to JPEG if puppeteer is available
    await convertHtmlToJpeg(tempHtmlPath, outputFilePath);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));

  if (args.length < 1) {
    console.error('Usage: node tasks-chart.js <input-csv-file> [output-jpeg-file] [--puppeteer]');
    console.error('Example: node tasks-chart.js tasks.csv chart.jpg');
    console.error('Add --puppeteer flag to generate JPEG directly (requires npm install puppeteer)');
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

  // Ensure output has .jpg extension
  if (!outputFilePath.toLowerCase().endsWith('.jpg') &&
    !outputFilePath.toLowerCase().endsWith('.jpeg')) {
    outputFilePath += '.jpg';
  }

  return { inputFilePath, outputFilePath };
}

// Run the script
const { inputFilePath, outputFilePath } = parseArgs();
processCSVAndGenerateChart(inputFilePath, outputFilePath);