import type { ElementDetail } from '@talelabs/sdk'

import { ELEMENT_DETAIL_VIEW_REGISTRY } from './detail-views/element-detail-view-registry'

export function ElementDataView({ element }: { element: ElementDetail }) {
  const DetailView = ELEMENT_DETAIL_VIEW_REGISTRY[element.type]
  return <DetailView element={element} />
}
