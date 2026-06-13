#!/usr/bin/env python3
"""
SammyOS Launcher
Double-click SammyOS.vbs to run silently (no cmd window).
All output is written to launcher.log in the same folder.
"""

import os
import sys
import json
import shutil
import subprocess
import platform
import urllib.request
from pathlib import Path
from datetime import datetime, timedelta

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
GITHUB_REPO    = "braxtonvogel/SammyOS-AI-Workspace"
GITHUB_BRANCH  = "main"
ROOT_DIR       = Path(__file__).parent
DESKTOP_DIR    = ROOT_DIR / "apps" / "desktop"
LOG_FILE       = ROOT_DIR / "launcher.log"
NODE_MIN_MAJOR = 18

# ─────────────────────────────────────────────
# LOGGING  (file only — no terminal needed)
# ─────────────────────────────────────────────

_log_handle = None

def _open_log():
    global _log_handle
    _log_handle = open(LOG_FILE, "w", encoding="utf-8")
    _write(f"SammyOS Launcher  —  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    _write("=" * 52)

def _write(msg):
    if _log_handle:
        _log_handle.write(msg + "\n")
        _log_handle.flush()

def log(msg):    _write(f"  {msg}")
def ok(msg):     _write(f"  [OK]  {msg}")
def warn(msg):   _write(f"  [!!]  {msg}")
def err(msg):    _write(f"  [XX]  {msg}")
def header(msg): _write(f"\n{msg}")

def fatal(msg):
    err(msg)
    if _log_handle:
        _log_handle.close()
    sys.exit(1)

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def run(cmd, cwd=None):
    result = subprocess.run(
        cmd, shell=True, cwd=cwd,
        capture_output=True, text=True
    )
    if result.stdout: _write(result.stdout.strip())
    if result.stderr: _write(result.stderr.strip())
    if result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, cmd)
    return result

def run_safe(cmd, cwd=None):
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

def which(name):
    return shutil.which(name) is not None

def fetch_json(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SammyOS-Launcher/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        return None

# ─────────────────────────────────────────────
# STEP 1 — DEPENDENCY CHECKS
# ─────────────────────────────────────────────

def check_node():
    header("Checking Node.js ...")
    if not which("node"):
        fatal(
            "Node.js not found.\n"
            "  Download from https://nodejs.org (LTS)\n"
            "  After installing, double-click SammyOS.vbs again."
        )
    _, ver, _ = run_safe("node --version")
    try:
        major = int(ver.lstrip("v").split(".")[0])
    except ValueError:
        major = 0
    if major < NODE_MIN_MAJOR:
        fatal(f"Node.js {ver} is too old — v{NODE_MIN_MAJOR}+ required. Upgrade at https://nodejs.org")
    ok(f"Node.js {ver}")

def check_npm():
    header("Checking npm ...")
    if not which("npm"):
        fatal("npm not found. Reinstall Node.js from https://nodejs.org")
    _, ver, _ = run_safe("npm --version")
    ok(f"npm {ver}")

def check_rust():
    header("Checking Rust / Cargo ...")
    cargo_bin = Path.home() / ".cargo" / "bin"
    if cargo_bin.exists():
        os.environ["PATH"] = str(cargo_bin) + os.pathsep + os.environ["PATH"]
    if which("rustc") and which("cargo"):
        _, ver, _ = run_safe("rustc --version")
        ok(f"Rust  {ver}")
        return
    if platform.system() == "Windows":
        fatal(
            "Rust not found.\n"
            "  Install from https://rustup.rs — download and run rustup-init.exe.\n"
            "  After installing, double-click SammyOS.vbs again."
        )
    else:
        log("Rust not found — installing via rustup ...")
        try:
            run('curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y')
            os.environ["PATH"] = str(cargo_bin) + os.pathsep + os.environ["PATH"]
            ok("Rust installed.")
        except subprocess.CalledProcessError:
            fatal("Rust installation failed. Visit https://rustup.rs")

def check_tauri_cli():
    header("Checking Tauri CLI ...")
    code, _, _ = run_safe("npm list --depth=0 @tauri-apps/cli", cwd=DESKTOP_DIR)
    if code == 0:
        ok("@tauri-apps/cli found")
        return
    code2, out, _ = run_safe("npx tauri --version")
    if code2 == 0:
        ok(f"Tauri CLI via npx  ({out})")
        return
    log("@tauri-apps/cli not found — installing ...")
    try:
        run("npm install --save-dev @tauri-apps/cli", cwd=DESKTOP_DIR)
        ok("@tauri-apps/cli installed.")
    except subprocess.CalledProcessError as e:
        fatal(f"Could not install @tauri-apps/cli: {e}")

def check_npm_deps():
    header("Checking npm dependencies ...")
    if not (DESKTOP_DIR / "node_modules").exists():
        log("node_modules missing — running npm install ...")
        try:
            run("npm install", cwd=DESKTOP_DIR)
            ok("npm install complete.")
        except subprocess.CalledProcessError as e:
            fatal(f"npm install failed: {e}")
    else:
        ok("node_modules present")

# ─────────────────────────────────────────────
# STEP 2 — GITHUB UPDATE CHECK
# ─────────────────────────────────────────────

def get_local_commit():
    code, out, _ = run_safe("git rev-parse HEAD")
    return out if code == 0 else None

def get_remote_commit():
    data = fetch_json(
        f"https://api.github.com/repos/{GITHUB_REPO}/commits/{GITHUB_BRANCH}"
    )
    return data["sha"] if data and "sha" in data else None

def repo_is_nonempty():
    data = fetch_json(f"https://api.github.com/repos/{GITHUB_REPO}")
    if not data or data.get("size", 0) == 0:
        return False
    ref = fetch_json(
        f"https://api.github.com/repos/{GITHUB_REPO}/git/ref/heads/{GITHUB_BRANCH}"
    )
    return bool(ref and "object" in ref)

def apply_update():
    log("Pulling latest changes ...")
    try:
        run(f"git pull origin {GITHUB_BRANCH}")
        ok("Pull complete.")
    except subprocess.CalledProcessError as e:
        warn(f"git pull failed: {e}  — continuing with existing code.")
        return
    log("Running npm install after update ...")
    try:
        run("npm install", cwd=DESKTOP_DIR)
        ok("npm install complete.")
    except subprocess.CalledProcessError:
        warn("npm install failed after update — continuing anyway.")

def check_for_updates():
    header("Checking GitHub for updates ...")
    log("Verifying remote repo is non-empty (safety check) ...")
    if not repo_is_nonempty():
        warn("Remote repo empty or unreachable — skipping update to protect local files.")
        return
    local = get_local_commit()
    if not local:
        warn("git unavailable — skipping update check.")
        return
    remote = get_remote_commit()
    if not remote:
        warn("Could not reach GitHub API — skipping update check.")
        return
    if remote.startswith(local) or local.startswith(remote):
        ok("Already up to date.")
    else:
        log(f"Update found  ({local[:8]}  ->  {remote[:8]})")
        apply_update()

# ─────────────────────────────────────────────
# STEP 3 — LAUNCH
# ─────────────────────────────────────────────

def launch():
    header("Launching SammyOS ...")
    log(f"Directory: {DESKTOP_DIR}")
    try:
        npm_path = shutil.which("npm")
        if not npm_path:
            fatal("Could not find npm on PATH.")

        if platform.system() == "Windows":
            task_name = "SammyOSLaunch"
            desktop_dir_str = str(DESKTOP_DIR)

            # Check if SammyOS is already running — if so, do nothing
            check = subprocess.run(
                ["tasklist", "/fi", "imagename eq node.exe", "/fo", "csv", "/nh"],
                capture_output=True, text=True
            )
            # Look for a node process running from our desktop dir
            running_check = subprocess.run(
                ["wmic", "process", "where", "name='node.exe'", "get", "CommandLine", "/format:list"],
                capture_output=True, text=True
            )
            if desktop_dir_str.lower() in running_check.stdout.lower():
                warn("SammyOS is already running — skipping launch.")
                return

            # Delete any leftover task from a previous run
            subprocess.run(
                ["schtasks", "/delete", "/tn", task_name, "/f"],
                capture_output=True
            )

            start_time = (datetime.now() + timedelta(minutes=2)).strftime("%H:%M")
            current_user = os.environ.get("USERNAME", "")

            # Write helper .vbs — launches npm silently and deletes the task after
            helper_vbs = ROOT_DIR / "launcher_helper.vbs"
            helper_vbs.write_text(
                f'Set shell = CreateObject("WScript.Shell")\n'
                f'shell.Run "cmd.exe /c cd /d {desktop_dir_str} && npm run tauri dev", 0, False\n'
                f'shell.Run "schtasks /delete /tn {task_name} /f", 0, True\n',
                encoding="utf-8"
            )

            create = subprocess.run([
                "schtasks", "/create",
                "/tn", task_name,
                "/tr", f'wscript.exe "{helper_vbs}"',
                "/sc", "once",
                "/st", start_time,
                "/ru", current_user,
                "/f"
            ], capture_output=True, text=True)

            if create.returncode != 0:
                fatal(f"Failed to create scheduled task: {create.stderr.strip()}")

            run_task = subprocess.run(
                ["schtasks", "/run", "/tn", task_name],
                capture_output=True, text=True
            )

            if run_task.returncode != 0:
                fatal(f"Failed to run scheduled task: {run_task.stderr.strip()}")

            ok("SammyOS launched via Task Scheduler (fully detached).")
            _write("\nLauncher done — SammyOS is running.")

        else:
            process = subprocess.Popen(
                [npm_path, "run", "tauri", "dev"],
                cwd=DESKTOP_DIR,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True
            )
            ok(f"SammyOS started (PID {process.pid})")
            _write("\nLauncher done — SammyOS is running.")

    except Exception as e:
        fatal(f"Failed to start SammyOS: {e}")

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    _open_log()
    check_node()
    check_npm()
    check_rust()
    check_tauri_cli()
    check_npm_deps()
    check_for_updates()
    launch()
    if _log_handle:
        _log_handle.close()

if __name__ == "__main__":
    main()