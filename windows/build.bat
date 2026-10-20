@echo off
setlocal
rem Builds build\Murmuration.scr (the screensaver and the app in one file) with MSVC.
rem   build.bat        build it
rem   build.bat dev    build it, then open the app loading ..\web live (edit, then press F5 or restart)
rem Needs Visual Studio 2022 (or its Build Tools) with the C++ workload. Everything else
rem (the WebView2 SDK) is fetched once into deps\ and checked against a pinned hash.

set "WV2_VERSION=1.0.4258.31"
set "WV2_SHA256=56f7f4b8bf9aee4b8efefbbdd4f67d5f74ebd1b100ed0806da71bf76af481aa9"

set "VSDEV=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
if not exist "%VSDEV%" set "VSDEV=C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat"
if not exist "%VSDEV%" set "VSDEV=C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
if not exist "%VSDEV%" set "VSDEV=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if not exist "%VSDEV%" (
    echo Could not find Visual Studio 2022 ^(vcvars64.bat^). Install it with the "Desktop development with C++" workload.
    exit /b 1
)
rem vcvars looks for vswhere on PATH and complains harmlessly if it is missing.
set "PATH=%PATH%;%ProgramFiles(x86)%\Microsoft Visual Studio\Installer"
call "%VSDEV%" >nul
if errorlevel 1 exit /b 1

cd /d "%~dp0"
if not exist build mkdir build

call :webview2
if errorlevel 1 goto failed

powershell -NoProfile -ExecutionPolicy Bypass -File embed-web.ps1
if errorlevel 1 goto failed

rc /nologo /I build /fo build\murmuration.res murmuration.rc
if errorlevel 1 goto failed

set "WV2=deps\webview2\build\native"
cl /nologo /O2 /EHsc /W3 /DNDEBUG /DUNICODE /D_UNICODE /std:c++17 /utf-8 /I "%WV2%\include" ^
   /Fo:build\ /Fe:build\Murmuration.scr ^
   murmuration.cpp build\murmuration.res ^
   /link /SUBSYSTEM:WINDOWS /OPT:REF /OPT:ICF /MANIFEST:NO ^
   /LIBPATH:"%WV2%\x64" WebView2LoaderStatic.lib ^
   user32.lib gdi32.lib shell32.lib ole32.lib advapi32.lib comctl32.lib version.lib
if errorlevel 1 goto failed

rem Same program under an .exe name: double-click it to open the app, or pass /s to test
copy /y build\Murmuration.scr build\Murmuration.exe >nul

echo.
echo Built build\Murmuration.scr  (right-click it and choose Install)
echo   and build\Murmuration.exe  (the same program; opens the app)
if /i "%~1"=="dev" start "" build\Murmuration.exe /a /dev "%~dp0..\web"
exit /b 0

:webview2
if exist deps\webview2\build\native\include\WebView2.h exit /b 0
echo Fetching the WebView2 SDK %WV2_VERSION% ...
if not exist deps mkdir deps
set "PKG=deps\webview2.%WV2_VERSION%.nupkg"
curl -sfL -o "%PKG%" "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/%WV2_VERSION%/microsoft.web.webview2.%WV2_VERSION%.nupkg"
if errorlevel 1 (echo Download failed. & exit /b 1)
set "GOT="
for /f "delims=" %%h in ('certutil -hashfile "%PKG%" SHA256 ^| findstr /v ":"') do if not defined GOT set "GOT=%%h"
set "GOT=%GOT: =%"
if /i not "%GOT%"=="%WV2_SHA256%" (
    echo The WebView2 SDK download doesn't match the expected hash. Not using it.
    del "%PKG%"
    exit /b 1
)
mkdir deps\webview2 2>nul
tar -xf "%PKG%" -C deps\webview2 build/native/include build/native/x64 LICENSE.txt
if errorlevel 1 (echo Could not unpack the WebView2 SDK. & exit /b 1)
exit /b 0

:failed
echo.
echo BUILD FAILED
exit /b 1
