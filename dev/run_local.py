"""Run a lab-gen skill script the way the ACCI runtime does.

Mimics run_skill_script semantics: python argv subprocess (no shell), cwd = a
workspace directory, and (with --enforce-caps) the runtime's limits so cap
violations surface locally before deployment.

Usage:
    python dev/run_local.py [--script assemble] [--workspace dev/workspace]
                            [--enforce-caps] [script args...]

Example:
    python dev/run_local.py --theme theme.json --config lab-config.json --sim sim.js
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SKILL_SCRIPTS = REPO / "skills" / "lab-gen" / "scripts"

# ACCI runtime caps (app/runtimes/acci/_exec.py)
STDOUT_CAP = 24_000
TIMEOUT_S = 300


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, add_help=True)
    ap.add_argument("--script", default="assemble", help="script name under skills/lab-gen/scripts/ (default: assemble)")
    ap.add_argument("--workspace", default=str(REPO / "dev" / "workspace"), help="fake ACCI workspace dir")
    ap.add_argument("--enforce-caps", action="store_true", help="enforce runtime stdout/timeout caps")
    args, script_args = ap.parse_known_args()

    script = SKILL_SCRIPTS / f"{args.script}.py"
    if not script.exists():
        sys.exit(f"no such skill script: {script}")

    workspace = Path(args.workspace)
    workspace.mkdir(parents=True, exist_ok=True)

    cmd = [sys.executable, str(script), *script_args]
    print(f"$ (cwd={workspace}) {' '.join(cmd)}", file=sys.stderr)

    start = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_S if args.enforce_caps else None,
        )
    except subprocess.TimeoutExpired:
        sys.exit(f"TIMEOUT: exceeded the runtime's {TIMEOUT_S}s cap")
    elapsed = time.monotonic() - start

    if proc.stderr:
        sys.stderr.write(proc.stderr)
    sys.stdout.write(proc.stdout)

    if args.enforce_caps and len(proc.stdout.encode("utf-8")) > STDOUT_CAP:
        print(f"\nWARNING: stdout {len(proc.stdout.encode('utf-8'))} bytes exceeds the "
              f"runtime's {STDOUT_CAP} cap (would be truncated)", file=sys.stderr)

    print(f"[{elapsed:.2f}s, exit {proc.returncode}]", file=sys.stderr)
    sys.exit(proc.returncode)


if __name__ == "__main__":
    main()
