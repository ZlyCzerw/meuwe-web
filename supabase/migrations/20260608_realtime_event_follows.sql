-- Enable realtime for event_follows so clients can subscribe to follow/unfollow changes.
alter publication supabase_realtime add table event_follows;
