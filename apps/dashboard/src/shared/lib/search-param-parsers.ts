import { createParser } from 'nuqs'

const cuid2Pattern = /^[a-z][0-9a-z]{1,31}$/

export const parseAsCuid2 = createParser({
  parse: value => cuid2Pattern.test(value) ? value : null,
  serialize: value => value,
})
