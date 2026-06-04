INSERT INTO public.advertisers (id, name, advertiser_type, is_active, daily_cap, config)
VALUES ('00000000-0000-0000-0000-000000000001', 'Mock Advertiser', 'mock', true, 999999, '{}')
ON CONFLICT (id) DO NOTHING;
