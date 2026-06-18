import csv

def parse_file(file):
    data = []

    decoded = file.read().decode("utf-8").splitlines()
    reader = csv.DictReader(decoded)

    for row in reader:
        data.append({
            "name": row["name"],
            "email": row["email"],
            "company": row["company"],
            "requirement": row["requirement"]
        })

    return data