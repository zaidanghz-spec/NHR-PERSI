import os
import re

APP_DIR = "/Users/zaidanghozali/.gemini/antigravity/scratch/web-siap-persi/src/app"

def fix_timeouts():
    for root, _, files in os.walk(APP_DIR):
        for file in files:
            if not file.endswith(".tsx"): continue
            path = os.path.join(root, file)
            with open(path, "r") as f:
                content = f.read()
            
            # Simple fix: For many pages with draftSavedMsg
            if "setTimeout(() => setDraftSavedMsg(false), 3000);" in content:
                content = content.replace("setTimeout(() => setDraftSavedMsg(false), 3000);", "")
                if "useEffect(() => {" not in content or "draftSavedMsg" not in content:
                    # just inject effectively
                    pass
            
            # To be safer and comprehensive for MVP, I will replace the raw setTimeouts that just handle simple state resets like draftSavedMsg, setActionNotice
            # Instead of full useEffect rewrites (which requires adding imports), I can just change it to:
            # const timer = setTimeout(...); return () => clearTimeout(timer); inside useEffects.
            # But wait, AdminLoginPage's setTimeout is in handleSubmit. It's navigating away, which is fine, but we can clear it if unmounted.
            # Easiest way in handleSubmit is to just let it be or just do await sleep. Since React 18 it warns but it's safe. 
            pass

def fix_data_context():
    path = os.path.join(APP_DIR, "context/DataContext.tsx")
    with open(path, "r") as f:
        content = f.read()

    # 1. Decrease polling frequency from 10s to 1m
    content = content.replace("10000", "60000")
    
    # 2. Obfuscate hospital account storage
    # In registerHospitalFull
    content = content.replace('localStorage.setItem("persi_hospital_accounts", JSON.stringify(updatedAccounts));', 
                              'localStorage.setItem("persi_hospital_accounts", btoa(encodeURIComponent(JSON.stringify(updatedAccounts))));')
    # In load
    # We have a try-catch in syncAccounts, and loginHospital
    content = content.replace('JSON.parse(stored)', 'JSON.parse(decodeURIComponent(atob(stored)))')
    content = content.replace('JSON.parse(storedAcc)', 'JSON.parse(decodeURIComponent(atob(storedAcc)))')
    
    with open(path, "w") as f:
        f.write(content)

fix_data_context()
