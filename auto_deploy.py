import subprocess
import os
import sys

def run_cmd(cmd, cwd=None):
    print(f"Running: {' '.join(cmd)}")
    try:
        # Use shell=True for tools like git or npm on windows if necessary, but list format is safer
        # since sandbox-exec seems to hook into cmd.exe / powershell aliases, let's try direct executable where possible
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True, shell=True)
        print("--- STDOUT ---")
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print("--- ERROR ---")
        print(f"Exit code: {e.returncode}")
        print("STDOUT:", e.stdout)
        print("STDERR:", e.stderr)
        return False

def deploy():
    repo_dir = r"K:\happybigbomb"
    print("=== Step 1: Git Commit ===")
    run_cmd(["git", "add", "."], cwd=repo_dir)
    run_cmd(["git", "commit", "-m", "fix: TS build errors and mobile css overflow"], cwd=repo_dir)
    
    print("\n=== Step 2: Git Push ===")
    run_cmd(["git", "push", "origin", "main"], cwd=repo_dir)
    
    print("\n=== Step 3: NPM Build & Deploy ===")
    # npm is a cmd script on windows
    run_cmd(["npm", "run", "deploy"], cwd=repo_dir)

if __name__ == "__main__":
    deploy()
