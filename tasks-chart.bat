@echo off
REM tasks-chart.bat - Enhanced Schedule Changes Chart Generator

echo Schedule Changes Chart Generator
echo ===============================

IF "%~1"=="" (
  echo Usage: tasks-chart.bat inputfile.csv [outputfile.jpg]
  echo Example: tasks-chart.bat project-data.csv chart.jpg
  exit /b 1
)

SET INPUT_FILE=%~1
SET OUTPUT_FILE=%~n1_chart.jpg

IF NOT "%~2"=="" (
  SET OUTPUT_FILE=%~2
)

echo Input: %INPUT_FILE%
echo Output: %OUTPUT_FILE%
echo.

echo 1. Generating chart from CSV data...
node tasks-chart.js "%INPUT_FILE%" temp_chart.html

IF NOT EXIST "temp_chart.html" (
  echo Error: Failed to generate HTML chart.
  exit /b 1
)

echo HTML chart generated successfully.
echo.

echo 2. Converting HTML to full image...
node convert-html-to-image.js temp_chart.html "%OUTPUT_FILE%"

IF EXIST "%OUTPUT_FILE%" (
  echo Success! Full chart image saved to: %OUTPUT_FILE%
  echo Opening the image...
  start "" "%OUTPUT_FILE%"
) ELSE (
  echo Image conversion failed. Opening HTML file instead...
  start "" temp_chart.html
)

echo.
echo Done.
exit /b 0