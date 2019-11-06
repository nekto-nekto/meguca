create or replace function bump_thread(op bigint, bump_time bool = false, deleted bool = false, pid bigint = 0)
returns void
as $$
declare
	now_unix bigint := extract(epoch from now());
	last_bump_time bigint;
begin
	update threads
	 set update_time = now_unix
	 where id = op;
	if bump_thread.bump_time and not bump_thread.deleted and post_count(bump_thread.op) < 1000 then
		update threads
		 set bump_time = now_unix
		 where id = bump_thread.op;
	elseif bump_thread.deleted then
		if bump_thread.pid = bump_thread.op then
			update threads
			 set bump_time = 0
			 where id = bump_thread.op;
		else
			select p.time into last_bump_time
			 from posts p
			 where p.op = bump_thread.pid
			 and p.moderated = false
			 order by p.time desc limit 1;
			update threads
			 set bump_time = last_bump_time
			 where id = bump_thread.op;
		end if;
	end if;
end;
$$ language plpgsql;
