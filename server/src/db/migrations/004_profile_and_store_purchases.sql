-- Profile screen: photo/emoji avatar, contact details, light/dark preference.
ALTER TABLE profiles ADD COLUMN avatar text CHECK (avatar IS NULL OR length(avatar) <= 200000);
ALTER TABLE profiles ADD COLUMN phone text;
ALTER TABLE profiles ADD COLUMN country text;
ALTER TABLE profiles ADD COLUMN appearance text NOT NULL DEFAULT 'auto' CHECK (appearance IN ('auto', 'light', 'dark'));

-- In-app purchases through RevenueCat (App Store / Google Play).
-- The product identifier set up in App Store Connect / Play Console for each plan.
ALTER TABLE plans ADD COLUMN store_product_id text UNIQUE;
UPDATE plans SET store_product_id = id WHERE id IN ('premium_monthly', 'premium_yearly');
