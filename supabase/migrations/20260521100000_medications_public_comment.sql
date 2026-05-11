-- Public Tiaki: clarify medications table purpose (no bundled personal seed lists).
comment on table public.medications is 'Optional public dose-time templates for the medication timeline UI; user medications live in user_medications.';
