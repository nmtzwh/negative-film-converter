# Windows Release Guide

Since this application utilizes a Python backend with C-extensions (`numpy`, `scipy`, `opencv`, `rawpy`) alongside a Rust/React frontend (Tauri), the most reliable way to create a Windows release is to compile natively on a Windows machine.

This guide outlines the steps to build the standalone Python executable and package the final Tauri installer (`.msi` / `.exe`) on your local Windows development environment.

## Prerequisites (Windows Machine)

Ensure the following are installed on your Windows machine:
1. **Node.js** (v18+ recommended)
2. **Rust** (via rustup, ensures MSVC build tools are installed)
3. **Python 3.10+** (Ensure it is added to your PATH)
4. **Git**

## Step 1: Clone and Setup

Open a PowerShell or Command Prompt terminal on your Windows machine:

```powershell
# Clone the repository
git clone <your-repo-url>
cd negative-converter

# Install Node dependencies
npm install
```

## Step 2: Build the Python Sidecar

We use `PyInstaller` to bundle the FastAPI backend and all its heavy dependencies into a single standalone `.exe` file. Tauri expects this file to have a specific name based on the target architecture.

```powershell
# Navigate to the backend directory
cd backend

# Create a virtual environment and activate it
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install the backend requirements and pyinstaller
pip install -r requirements.txt
pip install pyinstaller

# Build the standalone executable
pyinstaller --onefile --noconsole --name python_sidecar server.py
```

### Important Dependency Note for PyInstaller
Libraries like `rawpy` and `opencv` sometimes require hidden imports to be explicitly stated. If the backend crashes on startup, you may need to update the PyInstaller command to include them:
```powershell
pyinstaller --onefile --noconsole --hidden-import cv2 --hidden-import numpy --hidden-import rawpy --name python_sidecar server.py
```

## Step 3: Move and Rename the Sidecar

Tauri expects the external binary to be located in `src-tauri/` and named precisely according to the target triple. For a standard 64-bit Windows build, the target is `x86_64-pc-windows-msvc`.

```powershell
# Go back to the project root
cd ..

# Move the built executable to the src-tauri folder and append the target triple
Move-Item -Path "backend\dist\python_sidecar.exe" -Destination "src-tauri\python_sidecar-x86_64-pc-windows-msvc.exe" -Force
```

*Note: Ensure `tauri.conf.json` has `externalBin: ["python_sidecar"]` configured (this is already set up in the repository).*

## Step 4: Build the Tauri Application

Now that the Windows-native Python backend is in place, you can build the final Tauri application.

```powershell
# Build the application
npm run tauri build
```

This process will compile the React frontend, compile the Rust binary, and package everything (including the Python sidecar) into an installer.

## Step 5: Locate the Installer

Once the build finishes successfully, you can find the distributable installers in:

`src-tauri/target/release/bundle/msi/`
(or `nsis/` depending on your Tauri configuration).

You can now distribute this `.msi` file to your Windows users!