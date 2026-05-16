import subprocess
import sys
import redis
from rq import Queue
from app.config import settings


def start_worker():
    """Launch the RQ worker in a child process so it can register signal handlers."""
    proc = subprocess.Popen(
        [sys.executable, "-m", "rq", "worker", "techmo_jobs",
         "--url", settings.redis_url,
         "--name", "techmo_worker"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return proc


def get_queue():
    conn = redis.from_url(settings.redis_url)
    return Queue("techmo_jobs", connection=conn)
