import os

APP_DIR = "/Users/zaidanghozali/.gemini/antigravity/scratch/web-siap-persi/src/app/context"

def revert_obfuscation():
    path = os.path.join(APP_DIR, "DataContext.tsx")
    with open(path, "r") as f:
        content = f.read()

    # Revert obfuscation in reading
    content = content.replace('JSON.parse(decodeURIComponent(atob(stored)))', 'JSON.parse(stored)')
    content = content.replace('JSON.parse(decodeURIComponent(atob(storedAcc)))', 'JSON.parse(storedAcc)')
    
    # Revert obfuscation in writing (if it was added there)
    content = content.replace('btoa(encodeURIComponent(JSON.stringify(updatedAccounts)))', 'JSON.stringify(updatedAccounts)')

    # Add a try catch for json parse of the sessionStorage hospital session to prevent crashes
    target1 = '''  const [currentHospital, setCurrentHospital] = useState<HospitalAccount | null>(() => {
    const stored = sessionStorage.getItem("persi_hospital_session");
    return stored ? JSON.parse(stored) : null;
  });'''
    replacement1 = '''  const [currentHospital, setCurrentHospital] = useState<HospitalAccount | null>(() => {
    const stored = sessionStorage.getItem("persi_hospital_session");
    if (!stored) return null;
    try { return JSON.parse(stored); } catch { return null; }
  });'''
    content = content.replace(target1, replacement1)

    with open(path, "w") as f:
        f.write(content)

revert_obfuscation()
