import { supabase } from '@/lib/supabase'

export interface PersonalSocialLink {
  id: string
  label: string
  url: string
}

export interface UserProfileData {
  bio: string
  skills: string[]
  interests: string[]
  socials: PersonalSocialLink[]
}

const DEFAULT_PROFILE: UserProfileData = {
  bio: '',
  skills: [],
  interests: [],
  socials: [],
}

export async function getProfile(userId: string): Promise<UserProfileData> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return { ...DEFAULT_PROFILE }
  return {
    bio: data.bio ?? '',
    skills: data.skills ?? [],
    interests: data.interests ?? [],
    socials: data.socials ?? [],
  }
}

export async function setProfile(userId: string, partial: Partial<UserProfileData>): Promise<void> {
  const current = await getProfile(userId)
  await supabase.from('user_profiles').upsert({
    user_id: userId,
    bio: partial.bio ?? current.bio,
    skills: partial.skills ?? current.skills,
    interests: partial.interests ?? current.interests,
    socials: partial.socials ?? current.socials,
  }, { onConflict: 'user_id' })
}

// ---- Preset options ----

export const PRESET_SKILLS = [
  'Programming', 'Web Development', 'Graphic Design', 'Video Editing',
  'Public Speaking', 'Leadership', 'Photography', 'Writing', 'Music',
  'Drawing', 'Math', 'Science', 'Research', 'Debate', 'Acting',
  'Dance', 'Robotics', '3D Modeling', 'Data Analysis', 'Sports',
]

export const PRESET_INTERESTS = [
  'Technology', 'Arts & Crafts', 'Music', 'Sports', 'Environment',
  'Literature', 'Science', 'History', 'Politics', 'Gaming',
  'Film', 'Photography', 'Travel', 'Cooking', 'Fashion',
  'Volunteering', 'Entrepreneurship', 'Mental Health', 'Space', 'Anime',
]

export const SOCIAL_PLATFORMS = [
  'Instagram', 'Twitter / X', 'LinkedIn', 'GitHub',
  'YouTube', 'TikTok', 'Discord', 'Website', 'Other',
]
