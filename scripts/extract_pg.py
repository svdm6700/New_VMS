import zipfile
import os

zip_path = os.getenv("PG_BINARIES_ZIP", r"D:\pgsql_binaries.zip")
target_dir = os.getenv("PG_TARGET_DIR", r"D:\pgsql")

print("Opening zip:", zip_path)
os.makedirs(target_dir, exist_ok=True)

with zipfile.ZipFile(zip_path, 'r') as zf:
    namelist = zf.namelist()
    print(f"Total entries in archive: {len(namelist)}")
    
    # We only need server binaries (bin, lib, share)
    needed = [name for name in namelist if name.startswith("pgsql/bin/") or name.startswith("pgsql/lib/") or name.startswith("pgsql/share/")]
    print(f"Server entries to extract: {len(needed)}")
    
    zf.extractall(path=r"D:\\", members=needed)

print("Extraction completed!")
if os.path.exists(r"D:\pgsql\bin\postgres.exe"):
    print("postgres.exe exists!")
if os.path.exists(r"D:\pgsql\bin\initdb.exe"):
    print("initdb.exe exists!")
