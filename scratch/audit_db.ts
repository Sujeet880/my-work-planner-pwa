import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase config');
  process.exit(1);
}

const supabase = createClient(url, key);

async function inspect() {
  console.log('--- Database Security Audit ---');

  // 1. Check profiles
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  console.log('Profiles count:', profiles?.length, 'Error:', profErr?.message);
  if (profiles) {
    profiles.forEach((p) => console.log('  Profile:', p.id, p.email, p.full_name));
  }

  // 2. Check projects
  const { data: projects, error: projErr } = await supabase.from('projects').select('*');
  console.log('Projects count:', projects?.length, 'Error:', projErr?.message);
  if (projects) {
    projects.forEach((p) => console.log('  Project:', p.id, p.name, 'user_id:', p.user_id));
  }

  // 3. Check project_members
  const { data: members, error: memErr } = await supabase.from('project_members').select('*');
  console.log('Members count:', members?.length, 'Error:', memErr?.message);
  if (members) {
    members.forEach((m) =>
      console.log('  Member:', m.id, 'project_id:', m.project_id, 'email:', m.invited_email, 'status:', m.membership_status, 'user_id:', m.user_id)
    );
  }

  // 4. Check project_invitations
  const { data: invites, error: invErr } = await supabase.from('project_invitations').select('*');
  console.log('Invites count:', invites?.length, 'Error:', invErr?.message);
  if (invites) {
    invites.forEach((i) =>
      console.log('  Invite:', i.id, 'project_id:', i.project_id, 'email:', i.invited_email, 'expires:', i.expires_at, 'accepted:', i.accepted_at)
    );
  }
}

inspect();
