-- ON CONFLICT needs read access to evaluate the inbox dedupe key.
-- The login worker still has no direct table privileges.

GRANT SELECT ON notifications TO family_notification_worker;
