# mentorx

Hosted LiveKit POC setup is documented in [docs/HOSTED_LIVEKIT_POC.md](/home/shashank/project/mentorx/docs/HOSTED_LIVEKIT_POC.md).
The upcoming student practice-test module is outlined in [docs/MCQ_PRACTICE_TEST_PLAN.md](/home/shashank/project/mentorxai/docs/MCQ_PRACTICE_TEST_PLAN.md).

Docker run modes:

- Production-like (faster runtime): `docker compose -f infra/docker-compose.yml up --build -d`
- Development (hot reload): `docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up --build -d`
