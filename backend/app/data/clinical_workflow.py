"""Clinical workflow definitions — served via API (not hardcoded in frontend)."""

LAB_WORKFLOW = {
    "statuses": ["ordered", "sample_collected", "result_entered", "verified", "critical_alert"],
    "next": {
        "ordered": "sample_collected",
        "sample_collected": "result_entered",
        "result_entered": "verified",
    },
}

RADIOLOGY_WORKFLOW = {
    "statuses": ["ordered", "scheduled", "acquired", "reported", "critical"],
    "next": {
        "ordered": "scheduled",
        "scheduled": "acquired",
        "acquired": "reported",
    },
}
