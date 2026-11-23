import time
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.pdf_generator import generate_voters_a4_pdf

def run_benchmark():
    num_voters = 2500
    print(f"Creating {num_voters} synthetic voter records...")
    
    telugu_names = [
        "వెంకటేశ్వరరావు గారపాటి", "సత్యనారాయణ మద్దిన", "లక్ష్మి కాట్రు",
        "రామకృష్ణ పోతుల", "నాగమణి అడ్డాల", "దుర్గాప్రసాద్ బొక్కా",
        "భవాని పంతగాని", "శ్రీనివాసరావు పెనుమత్స", "సుబ్బారావు నడింపల్లి"
    ]
    rel_names = [
        "వెంకన్న", "రామయ్య", "సుబ్బారావు", "సత్తిరాజు", "అప్పారావు", "కృష్ణమూర్తి"
    ]
    
    voters = []
    for i in range(1, num_voters + 1):
        voters.append({
            "serial_no": str(i),
            "voter_id": f"SJC{1000000 + i}",
            "unique_key": f"K{i % 9000 + 1000:04d}",
            "electoral_roll_no": f"62 - 209 - {i}",
            "voter_name": telugu_names[i % len(telugu_names)],
            "relation_type": "తండ్రి" if i % 2 == 0 else "భర్త",
            "relation_name": rel_names[i % len(rel_names)],
            "age": str(20 + (i % 60)),
            "gender": "పు" if i % 2 == 0 else "స్త్రీ",
            "house_no": f"{i % 50 + 1}-{i % 10 + 1}",
            "document_id": "bench_doc",
            "source_page": (i // 30) + 1,
            "photo_path": None,
        })
    
    print(f"Starting PDF generation benchmark for {num_voters} voters...")
    start_time = time.time()
    
    pdf_bytes = generate_voters_a4_pdf(
        voters=voters,
        title="ఓటర్ల జాబితా (Voter List)",
        panchayat="రామచంద్రపురం",
        constituency="తాడేపల్లిగూడెం",
        district="పశ్చిమ గోదావరి",
        ward="2",
        mandal="పెంటపాడు"
    )
    
    elapsed = time.time() - start_time
    total_pages = (num_voters + 26) // 27
    size_mb = len(pdf_bytes) / (1024 * 1024)
    
    print("=" * 50)
    print("BENCHMARK RESULTS:")
    print(f"Total voters:       {num_voters}")
    print(f"Total pages:        {total_pages} pages (27 voters/page)")
    print(f"Total time elapsed: {elapsed:.2f} seconds")
    print(f"Pages per second:   {total_pages / elapsed:.2f} pages/sec")
    print(f"Voters per second:  {num_voters / elapsed:.2f} voters/sec")
    print(f"PDF Output size:    {size_mb:.2f} MB")
    print("=" * 50)
    
    if elapsed < 60.0:
        print(f"SUCCESS: Generated 2,500 voters PDF in {elapsed:.2f}s (< 60s target)! PASSED!")
    else:
        print(f"WARNING: Took {elapsed:.2f}s, exceeding 60s limit.")

if __name__ == "__main__":
    run_benchmark()
