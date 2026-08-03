-- Заметки тренера о клиенте (видны только в UI тренера)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS trainer_notes text DEFAULT '';
