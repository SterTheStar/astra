# Requires PowerShell 5.1+
$ErrorActionPreference = "Stop"

# Check for registries.h before compiling
if (-not (Test-Path "include/registries.h")) {
    Write-Host "Error: 'include/registries.h' is missing."
    Write-Host "Please follow the 'Compilation' section of the README to generate it."
    exit 1
}

# Determine executable suffix for Windows
$exe = ""
if ([System.Environment]::OSVersion.Platform -eq "Win32NT") {
    $exe = ".exe"
}

# Detect OS and set Windows-specific linker options
$windows_linker = ""
if ([System.Environment]::OSVersion.Platform -eq "Win32NT") {
    $windows_linker = "-lws2_32 -pthread -lm"
}

# Default compiler
$compiler = "gcc"

# Handle script arguments for Windows 9x build
foreach ($arg in $args) {
    switch ($arg) {
        "--9x" {
            if ($unameOut -like "MINGW64_NT*") {
                $compiler = "/opt/bin/i686-w64-mingw32-gcc"
                $windows_linker += " -Wl,--subsystem,console:4"
            } else {
                Write-Host "Error: Compiling for Windows 9x is only supported when running under the MinGW64 shell."
                exit 1
            }
        }
    }
}

# Remove previous executable if exists
$exePath = "astra$exe"
if (Test-Path $exePath) {
    Remove-Item $exePath
}

# Compile all C files in src/
$srcFiles = Get-ChildItem -Path "src" -Filter "*.c" | ForEach-Object { $_.FullName }
$includeDir = "-Iinclude"
$optimization = "-O3"
$compileCommand = "$compiler $($srcFiles -join ' ') $optimization $includeDir -o $exePath $windows_linker"

Write-Host "Compiling with command:"
Write-Host $compileCommand

# Execute compilation
Invoke-Expression $compileCommand

# Run the compiled executable
Write-Host "Running $exePath..."
& ".\$exePath"
