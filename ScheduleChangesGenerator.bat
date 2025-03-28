@echo off
echo Schedule Changes Generator
echo ===============================

set INPUT=input
set OUTPUT=output

if "%~1"=="" goto default_mode
goto custom_mode

:default_mode
echo Using default folders: %INPUT% -^> %OUTPUT%
echo.

if not exist "%INPUT%" (
  echo Creating input directory: %INPUT%
  mkdir "%INPUT%"
  echo.
  echo NOTICE: Please place your CSV files in the "%INPUT%" folder and run again.
  goto end
)

echo Input directory: %INPUT%
echo Output directory: %OUTPUT%
echo.

echo Processing all CSV files in directory...
node tasks-chart.js "%INPUT%" "%OUTPUT%"
goto end

:custom_mode
set INPUT_PATH=%~1

if not exist "%INPUT_PATH%" (
  echo ERROR: Input path does not exist: %INPUT_PATH%
  goto end
)

dir /a:d "%INPUT_PATH%" >nul 2>&1
if not errorlevel 1 (
  rem Directory mode
  set INPUT_DIR=%INPUT_PATH%
  
  if "%~2"=="" (
    set OUTPUT_DIR=output
  ) else (
    set OUTPUT_DIR=%~2
  )
  
  echo Input directory: %INPUT_DIR%
  echo Output directory: %OUTPUT_DIR%
  echo.
  
  echo Processing all CSV files in directory...
  node tasks-chart.js "%INPUT_DIR%" "%OUTPUT_DIR%"
) else (
  rem File mode
  set INPUT_FILE=%INPUT_PATH%
  
  if "%~2"=="" (
    set OUTPUT_FILE=%~n1.html
  ) else (
    set OUTPUT_FILE=%~2
  )
  
  echo Input file: %INPUT_FILE%
  echo Output file: %OUTPUT_FILE%
  echo.
  
  echo Processing CSV file...
  node tasks-chart.js "%INPUT_FILE%" "%OUTPUT_FILE%"
)

:end
echo.
echo Done.