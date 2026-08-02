# Настройка Supabase для PROGRESS

После этих шагов код тренера будет работать на **любом устройстве** — данные хранятся в облаке, а не в localStorage браузера.

---

## 1. Регистрация и проект на supabase.com

1. Открой [https://supabase.com](https://supabase.com) и нажми **Start your project**.
2. Войди через GitHub (или email).
3. **New project**:
   - **Name:** `progress-app` (или любое)
   - **Database Password:** придумай и **сохрани** (для SQL-редактора не нужен каждый раз, но пригодится)
   - **Region:** ближайший к пользователям (например Frankfurt)
4. Дождись создания проекта (~1–2 мин).

---

## 2. Создание таблиц

1. В левом меню: **SQL Editor** → **New query**.
2. Скопируй **весь** файл `supabase/schema.sql` из репозитория.
3. Нажми **Run** (или Ctrl+Enter).
4. Должно появиться «Success» — созданы таблицы `trainers`, `clients`, `programs`, `workout_logs`, `body_metrics`.

---

## 3. Ключи API

1. **Project Settings** (шестерёнка) → **API**.
2. Скопируй:
   - **Project URL** → это `VITE_SUPABASE_URL`
   - **anon public** key → это `VITE_SUPABASE_ANON_KEY`

> Не используй `service_role` key во фронтенде — только `anon`.

---

## 4. Локальная разработка

В корне проекта создай файл `.env`:

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Запуск:

```bash
npm install
npm run dev
```

---

## 5. Переменные на Vercel (продакшен)

1. [vercel.com](https://vercel.com) → твой проект **progress-app**.
2. **Settings** → **Environment Variables**.
3. Добавь **обе** переменные:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | URL из Supabase API |
| `VITE_SUPABASE_ANON_KEY` | anon key из Supabase API |

4. Environment: отметь **Production**, **Preview**, **Development**.
5. **Save**.
6. **Deployments** → последний деплой → **⋯** → **Redeploy** (чтобы подтянуть env).

---

## 6. Git: что закоммитить и запушить

Закоммить и запушить в GitHub:

- `src/lib/supabase.js`
- `src/lib/trainerDb.js`
- `src/linkedClientTabs.jsx`
- `src/App.jsx` (обновлённый)
- `supabase/schema.sql`
- `.env.example`
- `package.json` / `package-lock.json`

**Не коммить** файл `.env` с реальными ключами (он в `.gitignore`).

После push Vercel соберёт новую версию. Если env уже добавлены — redeploy или дождись автодеплоя.

---

## 7. Проверка «код на другом устройстве»

### Устройство A (тренер)

1. Открой сайт → **Я тренер**.
2. **Добавить клиента** → имя, например «Тест».
3. Скопируй **код клиента** (6 символов).
4. Открой клиента → **Программа** → добавь день и упражнение → **Сохранить**.

### Устройство B (клиент) — другой браузер или телефон

1. Открой **тот же URL** сайта.
2. **Я клиент** → вкладка **Профиль**.
3. Введи код от тренера → **Подключиться**.
4. Вкладка **Тренировки** — должна появиться программа тренера.
5. Запиши тренировку → **Сохранить**.

### Обратно на устройстве A

1. Тренер → клиент → **Прогресс** — должны быть логи и метрики с устройства B.

---

## Что остаётся в localStorage

| Ключ | Назначение |
|------|------------|
| `app-role` | Выбранная роль: trainer / client |
| `client-code` | Код подключения к тренеру |
| `trainer-id` | ID тренера в Supabase (создаётся автоматически) |
| `workout-program`, `workout-logs`, `body-metrics`, … | Только для **автономного** режима клиента без тренера |

---

## Безопасность (позже)

Сейчас RLS открыт для MVP (любой с anon key может читать/писать). Для продакшена с реальными пользователями добавь Supabase Auth и политики по `auth.uid()`.
