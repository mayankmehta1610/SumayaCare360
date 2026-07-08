"""Background worker — processes notification outbox."""
import time
from datetime import datetime, timezone
from app.db.session import SessionLocal
from app.models.entities import NotificationOutbox


def process_once():
    db = SessionLocal()
    try:
        pending = (
            db.query(NotificationOutbox)
            .filter(NotificationOutbox.status == "pending", NotificationOutbox.is_deleted == False)
            .limit(20)
            .all()
        )
        for n in pending:
            # Dev stub: mark sent (MailHog integration can replace this)
            n.status = "sent"
            n.sent_at = datetime.now(timezone.utc)
        db.commit()
        return len(pending)
    finally:
        db.close()


def main():
    print("SUMAYA Care 360 worker started")
    while True:
        try:
            n = process_once()
            if n:
                print(f"Processed {n} notifications")
        except Exception as e:
            print(f"Worker error: {e}")
        time.sleep(5)


if __name__ == "__main__":
    main()
