## Container API

Проект реализует REST API для учёта контейнеров и зон хранения с базовой бизнес-логикой.

## Цель

Проверка навыков проектирования API, работы с базой данных и реализации бизнес-логики для системы учёта контейнеров.

## Стек технологий

Node.js (Express.js)

PostgreSQL (через pg)

Swagger для документации

WebSocket для событий обновления контейнера

## Модели

containers:

id

number

type

status

zone_id

arrival_time

zones:

id

name

capacity

current_load

type

## Эндпоинты

GET /containers — получить список всех контейнеров

POST /containers — добавить контейнер

PATCH /containers/:id — обновить статус контейнера

GET /zones — получить список всех зон

POST /zones/:id/assign — назначить контейнер в зону (с проверкой capacity)

POST /containers/:id/ship — отгрузка контейнера (уменьшение current_load зоны)

## Бизнес-логика

При добавлении контейнера статус создаётся как "new".

При назначении контейнера в зону, если зона переполнена, возвращается ошибка 400 ("Zone Overloaded").

При отгрузке контейнера уменьшается current_load зоны, если контейнер был назначен.

В API реализованы WebSocket-события при изменении статуса контейнера.

## Установка и запуск

Клонировать репозиторий:

git clone https://github.com/yerrrko/ContainerApi.git

Перейти в папку проекта:

cd ContainerApi

Установить зависимости:

npm install

Создать файл .env в корне проекта с содержимым:

DB_HOST=localhost # адрес сервера PostgreSQL
DB_PORT=5432 # порт PostgreSQL
DB_USER=postgres # имя пользователя
DB_PASSWORD=postgres # пароль (заменить на свой, если отличается)
DB_NAME=containerdb # название базы данных (создать заранее)
PORT=3000 # порт сервера

Запустить сервер:

npm run dev

Открыть документацию Swagger:

http://localhost:3000/docs

Проверять API через Swagger UI или Postman.

## Проверка работы WebSocket

При подключении WebSocket-событий сервер отправляет обновления при изменении статуса контейнера. Для проверки:

Открыть консоль DevTools в браузере.

Создать подключение:

const socket = io('http://localhost:3000
');

Прослушивать события:

socket.on('containerUpdated', (data) => console.log(data));

Для тестирования через Node.js можно установить библиотеку socket.io-client:

npm install socket.io-client

## Примечания

В проекте не использовался Docker.

Все эндпоинты полностью описаны в Swagger документации (/docs).

Для работы проекта необходима локальная PostgreSQL база данных.