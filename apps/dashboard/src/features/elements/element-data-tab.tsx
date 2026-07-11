import type { ElementDetail } from '@talelabs/sdk'

import { ElementDataView } from './element-data-view'

export function ElementDataTab({ element }: { element: ElementDetail }) {
  return <ElementDataView element={element} />
}
