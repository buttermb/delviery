-- Enable realtime for POS tables
ALTER PUBLICATION supabase_realtime ADD TABLE pos_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_cash_drawer_events;

-- Set replica identity to full for complete row data
ALTER TABLE pos_transactions REPLICA IDENTITY FULL;
ALTER TABLE pos_shifts REPLICA IDENTITY FULL;
ALTER TABLE pos_cash_drawer_events REPLICA IDENTITY FULL;