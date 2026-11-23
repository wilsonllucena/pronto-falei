import Link from 'next/link'
import React from 'react'

import { isExternal, type NavLink } from '@/lib/site'

export function NavLinkItem({ item, className }: { item: NavLink; className?: string }) {
  if (isExternal(item.url) || item.newTab) {
    return (
      <a
        href={item.url}
        className={className}
        {...(item.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {item.label}
      </a>
    )
  }
  return (
    <Link href={item.url} className={className}>
      {item.label}
    </Link>
  )
}
