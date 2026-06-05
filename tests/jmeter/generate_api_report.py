import csv
import os
import sys

def calculate_percentile(data, percentile):
    if not data:
        return 0
    size = len(data)
    sorted_data = sorted(data)
    idx = int((size - 1) * (percentile / 100.0))
    return sorted_data[idx]

def generate_report(jtl_path):
    if not os.path.exists(jtl_path):
        print(f"Error: File {jtl_path} does not exist.")
        return

    stats = {}

    with open(jtl_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                label = row['label']
                elapsed = int(row['elapsed'])
                latency = int(row['Latency'])
                connect = int(row['Connect'])
                success = row['success'].lower() == 'true'

                # Calculate approximate Server API processing time
                # API Processing Time = Latency - Connect Time
                api_proc_time = max(0, latency - connect)

                if label not in stats:
                    stats[label] = {
                        'count': 0,
                        'success_count': 0,
                        'elapsed_list': [],
                        'api_proc_list': [],
                        'connect_list': []
                    }

                stats[label]['count'] += 1
                if success:
                    stats[label]['success_count'] += 1
                stats[label]['elapsed_list'].append(elapsed)
                stats[label]['api_proc_list'].append(api_proc_time)
                stats[label]['connect_list'].append(connect)
            except Exception as e:
                # Skip invalid rows
                continue

    # Generate Markdown Report
    report = []
    report.append("# API Internal Processing Time Performance Report")
    report.append("\nThis report extracts the internal API processing time (estimated as **Latency - Connect Time**) to filter out connection handshake overhead.")
    report.append("\n### Detailed API Metrics (all times in ms)\n")
    
    headers = [
        "API Label", "Requests", "Success Rate", 
        "Avg Total Time", "Avg API Proc Time", 
        "Min API Proc", "Max API Proc", "90% Line", "95% Line"
    ]
    report.append("| " + " | ".join(headers) + " |")
    report.append("|" + "|".join(["---" for _ in headers]) + "|")

    for label, data in sorted(stats.items()):
        count = data['count']
        success_rate = (data['success_count'] / count) * 100 if count > 0 else 0
        
        elapsed_avg = sum(data['elapsed_list']) / count if count > 0 else 0
        api_proc_avg = sum(data['api_proc_list']) / count if count > 0 else 0
        
        api_proc_min = min(data['api_proc_list']) if count > 0 else 0
        api_proc_max = max(data['api_proc_list']) if count > 0 else 0
        
        pct_90 = calculate_percentile(data['api_proc_list'], 90)
        pct_95 = calculate_percentile(data['api_proc_list'], 95)

        row = [
            label,
            str(count),
            f"{success_rate:.2f}%",
            f"{elapsed_avg:.1f}",
            f"**{api_proc_avg:.1f}**",
            f"{api_proc_min}",
            f"{api_proc_max}",
            f"{pct_90}",
            f"{pct_95}"
        ]
        report.append("| " + " | ".join(row) + " |")

    report_content = "\n".join(report)
    print(report_content)
    
    # Save to a file
    report_output_path = os.path.join(os.path.dirname(jtl_path), "api_performance_report.md")
    with open(report_output_path, "w", encoding="utf-8") as out_f:
        out_f.write(report_content)
    print(f"\nReport saved to: {report_output_path}")

if __name__ == '__main__':
    jtl_file = "d:\\Exam-dectection\\exam-cheating-detection-v2\\tests\\jmeter\\results.jtl"
    generate_report(jtl_file)
