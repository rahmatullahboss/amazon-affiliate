INSERT INTO users (username, email, password_hash, role, is_active)
VALUES ('staff', 'staff@dealsrky.com', '100000$b5bf2d46a66f3681a60f25319e30524f:0a30a1727b1750aae8af116a347b7986ac08f9c90cac5b73a495c1da4b9e3fa3', 'admin', 1)
ON CONFLICT (username) 
DO UPDATE SET password_hash = '100000$b5bf2d46a66f3681a60f25319e30524f:0a30a1727b1750aae8af116a347b7986ac08f9c90cac5b73a495c1da4b9e3fa3', role = 'admin';
