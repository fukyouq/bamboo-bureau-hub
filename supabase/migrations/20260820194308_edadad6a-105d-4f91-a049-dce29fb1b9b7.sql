INSERT INTO public.profiles (id, full_name, email, role_id, must_change_password)
VALUES ('db3b6a6c-d988-4b02-b9d3-449b3f759fc3', 'Head of Bamboo Company', 'didopetdim@gmail.com', 1, false)
ON CONFLICT (id) DO NOTHING;