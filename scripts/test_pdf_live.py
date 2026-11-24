import urllib.request, json, time

# Test 1: Direct PDF generation
print("--- Testing /api/voters/pdf/generate ---")
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/voters/pdf/generate',
    data=json.dumps({}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req) as resp:
    data = resp.read()
    print('Generate endpoint status:', resp.status, 'PDF bytes:', len(data))

# Test 2: Page-wise PDF Export Job
print("\n--- Testing /api/voters/pdf/export-jobs ---")
req2 = urllib.request.Request(
    'http://127.0.0.1:8000/api/voters/pdf/export-jobs',
    data=json.dumps({"title": "Live Verification Job"}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req2) as resp:
    job = json.loads(resp.read().decode())
    print('Export job created:', job['id'], 'status:', job['status'], 'pages:', job['total_pages'])

job_id = job['id']
for i in range(30):
    time.sleep(0.5)
    req3 = urllib.request.Request(f'http://127.0.0.1:8000/api/voters/pdf/export-jobs/{job_id}')
    with urllib.request.urlopen(req3) as resp:
        st = json.loads(resp.read().decode())
        print(f"Polling [{i+1}]: status={st['status']}, pages={st['completed_pages']}/{st['total_pages']}, failed={st['failed_pages']}")
        if st['status'] in ('completed', 'failed'):
            break

# Test 3: Download job
print("\n--- Testing Download ---")
req4 = urllib.request.Request(f'http://127.0.0.1:8000/api/voters/pdf/export-jobs/{job_id}/download')
with urllib.request.urlopen(req4) as resp:
    dl_data = resp.read()
    print('Download endpoint status:', resp.status, 'Downloaded bytes:', len(dl_data))
    assert len(dl_data) > 0, "Downloaded PDF is empty"
    assert dl_data.startswith(b'%PDF'), "Downloaded data is not a valid PDF"

print("\nAll live PDF generation tests passed successfully!")
