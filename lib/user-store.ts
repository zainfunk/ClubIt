export async function setName(userId: string, name: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/user/overrides?userId=${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function setEmail(userId: string, email: string): Promise<void> {
  await fetch(`/api/user/overrides?userId=${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  })
}

export async function getOverride(userId: string): Promise<{ name?: string; email?: string }> {
  try {
    const res = await fetch(`/api/user/overrides?userId=${encodeURIComponent(userId)}`)
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

/** Sync pass-through — overrides are loaded async per-component via getOverride(). */
export function applyOverrides<T extends { id: string; name: string; email: string }>(user: T): T {
  return user
}
