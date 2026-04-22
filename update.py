import sys
import re

file_path = "/Users/zaidanghozali/.gemini/antigravity/scratch/web-siap-persi/src/app/data/specialtyAuditData.ts"

with open(file_path, "r") as f:
    content = f.read()

# 1. Update SDM names
content = content.replace('"Ners dan Sertifikasi/Fellowship CV"', '"Ners dan Sertifikasi/Fellowship Cardiovascular"')
content = content.replace('"Jumlah Ners (Total)"', '"Jumlah Ners"')

# 2. Update PREM/PROM "Apakah ...?" to "..." -> Statement
# We want to match: question: "Apakah X?" -> question: "X"
# Match case variations of "Apakah " or "Seberapa " etc.
# Actually, the quickest way is a simple regex: 
# Replace `question: "Apakah (.*)\?"` with `question: "\1"`
content = re.sub(r'question: "Apakah (.*?)\?"', lambda m: f'question: "{m.group(1).capitalize()}"', content)
content = re.sub(r'question: "(.*)\?", type: "(prem|prom)"', lambda m: f'question: "{m.group(1)}", type: "{m.group(2)}"', content)

# Some specific replacements if not caught
content = content.replace("Seberapa puas Anda dengan", "Anda puas dengan")
content = content.replace("Apakah Anda merasa", "Anda merasa")
content = content.replace("Apakah nyeri", "Nyeri")

# Lowercase the first letter after Apakah ? The lambda capitalize already does the first letter, but let's just make it cleanly capitalized.
def repl(m):
    text = m.group(1)
    return f'question: "{text[0].upper() + text[1:]}"'
    
with open(file_path, "w") as f:
    f.write(content)
