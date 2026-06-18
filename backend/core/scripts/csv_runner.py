import csv
import random

from core.tasks import process_and_send_email


def run_csv_test(file_path):

    delay_minutes = 0

    with open(file_path, newline='', encoding="utf-8") as file:

        reader = csv.DictReader(file)

        for row in reader:

            delay_minutes += random.randint(15, 20)

            process_and_send_email.apply_async(
                args=[
                    row["name"],
                    row["email"],
                    row["company"],
                    row["requirement"]
                ],
                countdown=delay_minutes * 60
            )

            print(
                f"Scheduled {row['email']} after {delay_minutes} minutes"
            )