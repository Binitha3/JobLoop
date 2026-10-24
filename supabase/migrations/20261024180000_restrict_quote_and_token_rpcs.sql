revoke all on function public.save_order_quote(uuid, numeric, numeric, numeric, date, text)
  from anon;
grant execute on function public.save_order_quote(uuid, numeric, numeric, numeric, date, text)
  to authenticated;

revoke all on function public.regenerate_order_tracking_token(uuid)
  from anon;
grant execute on function public.regenerate_order_tracking_token(uuid)
  to authenticated;

notify pgrst, 'reload schema';
