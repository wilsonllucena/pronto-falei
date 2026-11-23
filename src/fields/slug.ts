import { slugField } from 'payload'

import { toSlug } from '../lib/slugify'

/** Slug único gerado a partir de outro campo (padrão: title), sem acentos. */
export const slug = (useAsSlug = 'title') =>
  slugField({
    useAsSlug,
    slugify: ({ valueToSlugify }) => toSlug(valueToSlugify),
    overrides: (field) => {
      const slugInput = field.fields[1]
      if (slugInput && 'label' in slugInput) slugInput.label = 'Slug'
      return field
    },
  })
