import { notFound } from 'next/navigation'
import SchoolLabClient from './school-lab-client'

export default function SchoolLabPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return <SchoolLabClient />
}
