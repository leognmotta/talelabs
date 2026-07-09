export interface TeamMemberRow {
  createdAt: string
  email: string
  id: string
  inviteUrl?: string
  name: string
  role: 'admin' | 'member'
  sourceId: string
  status: 'active' | 'pending'
}
