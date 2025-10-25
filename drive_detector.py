#!/usr/bin/env python3
"""
Simple drive detection script for macOS
Step 2: Filter out system drives, only show external drives
"""

import os
import subprocess

def is_external_drive(drive_path):
    """Check if a drive is external (not the system drive)"""
    # Common system drive names to exclude
    system_drives = ['Macintosh HD', 'Data', 'System', 'Preboot']
    
    drive_name = os.path.basename(drive_path)
    
    # Exclude known system drives
    if drive_name in system_drives:
        return False
    
    # Additional check: use diskutil to get more info
    try:
        result = subprocess.run(['diskutil', 'info', drive_path], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            output = result.stdout
            # Check if it's marked as external
            if 'Removable Media:' in output and 'Yes' in output:
                return True
            # Check if it's a USB or external connection
            if any(protocol in output for protocol in ['USB', 'External', 'Thunderbolt']):
                return True
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        pass
    
    # Default: assume anything not in system_drives list might be external
    return True

def detect_external_drives():
    """Detect only external mounted drives on macOS"""
    volumes_path = "/Volumes"
    
    if not os.path.exists(volumes_path):
        print("Error: /Volumes directory not found")
        return []
    
    external_drives = []
    try:
        for item in os.listdir(volumes_path):
            drive_path = os.path.join(volumes_path, item)
            if os.path.isdir(drive_path) and is_external_drive(drive_path):
                external_drives.append({
                    'name': item,
                    'path': drive_path
                })
    except PermissionError as e:
        print(f"Permission error accessing drives: {e}")
        return []
    
    return external_drives

if __name__ == "__main__":
    print("Detecting external drives...")
    
    drives = detect_external_drives()
    
    if not drives:
        print("No external drives found")
    else:
        print(f"\nFound {len(drives)} external drive(s):")
        for i, drive in enumerate(drives, 1):
            print(f"  {i}. {drive['name']} -> {drive['path']}") 