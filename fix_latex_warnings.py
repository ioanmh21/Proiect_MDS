import glob

for f in glob.glob('agents/*.py'):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Înlocuim \( cu \\( și \[ cu \\[ pentru a rezolva escape sequence warning în string literals
    new_content = content.replace(r"\(", r"\\(").replace(r"\[", r"\\[")
    
    # Pentru orice eventualitate, dacă s-au format \\\\(, să le reparăm
    new_content = new_content.replace(r"\\\\(", r"\\(").replace(r"\\\\[", r"\\[")
    
    if content != new_content:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
        print(f"Reparat: {f}")

print("Toate avertismentele au fost reparate.")
