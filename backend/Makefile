.PHONY: setup up down ps logs test test-watch clean

setup:
	cd .. && npm install
	cd ../frontend/web && npm install || true

up:
	docker compose -f ../docker-compose.family.yml up -d

down:
	docker compose -f ../docker-compose.family.yml down

ps:
	docker compose -f ../docker-compose.family.yml ps

logs:
	docker compose -f ../docker-compose.family.yml logs -f

test:
	cd .. && npm run test:family-regression

test-watch:
	npx jest --config=jest.family-common.config.js --watch

clean:
	docker compose -f ../docker-compose.family.yml down -v
