#!/usr/bin/env sh
set -eu

echo "1) Current containers"
docker compose ps

echo ""
echo "2) Generate traffic"
for i in $(seq 1 10); do
  curl -s http://localhost:8088/api/health || true
  echo
done

echo ""
echo "4) Crash backend using the API endpoint through Nginx load balancer."
curl -s -X POST http://localhost:8088/api/crash || true
sleep 5
docker compose ps backend-a backend-b

echo ""
echo "5) Crash MySQL with SIGKILL. restart:unless-stopped should restart it."
docker kill -s KILL task_mysql || true
sleep 15
docker compose ps mysql

echo ""
echo "6) Check Docker stats. Press Ctrl+C to stop."
docker stats
