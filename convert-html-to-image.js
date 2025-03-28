// convert-html-to-image.js - Optimized for full page capture
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define file paths
const htmlPath = process.argv[2];
const outputPath = process.argv[3];

if (!htmlPath || !outputPath) {
  console.error('Usage: node convert-html-to-image.js <html-file> <output-image>');
  process.exit(1);
}

// Check if HTML file exists
if (!fs.existsSync(htmlPath)) {
  console.error(`HTML file not found: ${htmlPath}`);
  process.exit(1);
}

// Create package.json to install node-html-to-image if it doesn't exist
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.log('Creating package.json...');
  fs.writeFileSync(packageJsonPath, JSON.stringify({
    "name": "html-to-image-converter",
    "version": "1.0.0",
    "description": "HTML to Image Converter",
    "main": "convert-html-to-image.js",
    "dependencies": {
      "node-html-to-image": "^4.0.0"
    }
  }, null, 2));
}

// Install node-html-to-image if necessary
console.log('Checking for node-html-to-image...');
try {
  require.resolve('node-html-to-image');
  console.log('node-html-to-image is already installed');
} catch (error) {
  console.log('Installing node-html-to-image (this may take a moment)...');
  try {
    execSync('npm install node-html-to-image', { stdio: 'inherit' });
    console.log('node-html-to-image installed successfully');
  } catch (installError) {
    console.error(`Installation error: ${installError.message}`);
    console.log('\nIf npm install failed, try running these commands manually:');
    console.log('1. npm init -y');
    console.log('2. npm install node-html-to-image');
    console.log('3. node convert-html-to-image.js ' + htmlPath + ' ' + outputPath);
    process.exit(1);
  }
}

// Read HTML and modify it to ensure it's fully rendered and properly sized
function prepareHtmlForScreenshot(htmlContent) {
  // Add scripts and styles to ensure full content capture
  const enhancedHTML = htmlContent.replace('</head>',
    `<style>
    /* Force the body and html to be full size */
    html, body {
      margin: 0;
      padding: 0;
      overflow: visible !important;
      height: auto !important;
      width: auto !important;
    }
    /* Make sure the slide container fits all content */
    .slide-container {
      overflow: visible !important;
      height: auto !important;
      min-height: 900px;
    }
    /* Ensure table is fully visible */
    table {
      border-collapse: collapse;
      margin: 0;
      padding: 0;
    }
    /* Make sure charts are visible */
    .chart-container {
      overflow: visible !important;
    }
    </style>
    <script>
    // This script ensures the browser waits for all content to load
    window.onload = function() {
      // Give a bit more time to ensure fonts, etc. are loaded
      setTimeout(function() {
        document.body.classList.add('ready-for-screenshot');
      }, 500);
    };
    </script>
    </head>`
  );

  return enhancedHTML;
}

// Convert HTML to image
async function convertHtmlToImage() {
  console.log('Converting HTML to image...');

  const nodeHtmlToImage = require('node-html-to-image');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Prepare the HTML for better screenshot capture
  html = prepareHtmlForScreenshot(html);

  // Calculate optimal dimensions
  // Default dimensions that work well for most charts
  const width = 1800;  // Wider than the original 1600px
  const height = 1200; // Taller than the original 900px

  console.log(`Using dimensions: ${width}x${height}`);

  try {
    await nodeHtmlToImage({
      output: outputPath,
      html: html,
      puppeteerArgs: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          `--window-size=${width},${height}`,
          '--disable-web-security'
        ],
        defaultViewport: {
          width: width,
          height: height,
          deviceScaleFactor: 1.5 // Higher resolution
        }
      },
      selector: '.slide-container', // Only capture the slide container
      waitUntil: 'networkidle0', // Wait until all resources have loaded
      type: path.extname(outputPath).toLowerCase() === '.png' ? 'png' : 'jpeg',
      quality: 100
    });

    console.log(`Image saved to: ${outputPath}`);
  } catch (error) {
    console.error('Conversion error:', error);
    process.exit(1);
  }
}

// Run the conversion
convertHtmlToImage().catch(err => {
  console.error('Failed to convert HTML to image:', err);
  process.exit(1);
});