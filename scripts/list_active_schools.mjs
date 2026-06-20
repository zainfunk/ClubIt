import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await db
  .from('schools')
  .select('id, name, status, student_invite_code, advisor_invite_code, admin_invite_code')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(10)
if (error) { console.error(error); process.exit(1) }
console.log(JSON.stringify(data, null, 2))
