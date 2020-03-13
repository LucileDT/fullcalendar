import { VNode, h, Ref } from '../vdom'
import { findElements } from '../util/dom-manip'
import ComponentContext from '../component/ComponentContext'
import { computeSmallestCellWidth } from '../util/misc'
import { isPropsEqual } from '../util/object'
import { isArraysEqual } from '../util/array'


export type CssDimValue = string | number // TODO: move to more general file


export interface ColProps {
  width?: CssDimValue
  minWidth?: CssDimValue
  span?: number
}

export interface SectionConfig {
  outerContent?: VNode
  type?: 'body' | 'head' | 'foot'
  className?: string
  maxHeight?: number
  vGrow?: boolean
  vGrowRows?: boolean // TODO: how to get a bottom rule?
}

export type ChunkConfigContent = (contentProps: ChunkContentCallbackArgs) => VNode
export type ChunkConfigRowContent = VNode | ChunkConfigContent

export interface ChunkConfig {
  outerContent?: VNode
  content?: ChunkConfigContent
  rowContent?: ChunkConfigRowContent
  vGrowRows?: boolean
  scrollerElRef?: Ref<HTMLDivElement>
  elRef?: Ref<HTMLTableCellElement>
  className?: string // on the wrapping chunk <td>. impossible in print view
}

export interface ChunkContentCallbackArgs { // TODO: util for wrapping tables!?
  tableColGroupNode: VNode
  tableMinWidth: CssDimValue
  clientWidth: CssDimValue
  clientHeight: CssDimValue
  vGrowRows: boolean
  rowSyncHeights: { [rowKey: string]: number }
  reportRowHeight?: (rowKey: string, innerEl: HTMLElement) => void // TODO: don't make optional
}


export function computeShrinkWidth(chunkEls: HTMLElement[]) { // all in same COL!
  let shrinkCells = findElements(chunkEls, '.shrink')
  let largestWidth = 0

  for (let shrinkCell of shrinkCells) {
    largestWidth = Math.max(
      largestWidth,
      computeSmallestCellWidth(shrinkCell)
    )
  }

  return Math.ceil(largestWidth) // <table> elements work best with integers. round up to ensure contents fits
}


export interface ScrollerLike { // have scrollers implement?
  needsYScrolling(): boolean
  needsXScrolling(): boolean
}


export function getChunkVGrow(props: { vGrow?: boolean }, sectionConfig: SectionConfig, chunkConfig: ChunkConfig) {
  return (props.vGrow && sectionConfig.vGrow) || chunkConfig.vGrowRows
}


export function getAllowYScrolling(props: { vGrow?: boolean }, sectionConfig: SectionConfig, chunkConfig: ChunkConfig) {
  return (sectionConfig.maxHeight != null || (props.vGrow && sectionConfig.vGrow)) && !chunkConfig.vGrowRows
}


export function renderChunkContent(sectionConfig: SectionConfig, chunkConfig: ChunkConfig, arg: ChunkContentCallbackArgs) {
  let vGrowRows = sectionConfig.vGrowRows || chunkConfig.vGrowRows

  let content: VNode = typeof chunkConfig.content === 'function' ?
    chunkConfig.content(arg) :
    h('table', {
      style: {
        minWidth: arg.tableMinWidth, // because colMinWidths arent enough
        width: arg.clientWidth,
        height: vGrowRows ? arg.clientHeight : '' // css `height` on a <table> serves as a min-height
      }
    }, [
      arg.tableColGroupNode,
      h('tbody', {}, typeof chunkConfig.rowContent === 'function' ? chunkConfig.rowContent(arg) : chunkConfig.rowContent)
    ])

  return content
}


export function isColPropsEqual(cols0: ColProps[], cols1: ColProps[]) {
  return isArraysEqual(cols0, cols1, isPropsEqual)
}


export function renderMicroColGroup(cols: ColProps[], shrinkWidth?: number) {
  let colNodes: VNode[] = []

  /*
  for ColProps with spans, it would have been great to make a single <col span="">
  HOWEVER, Chrome was getting messing up distributing the width to <td>/<th> elements with colspans.
  SOLUTION: making individual <col> elements makes Chrome behave.
  */
  for (let colProps of cols) {
    let span = colProps.span || 1

    for (let i = 0; i < span; i++) {
      colNodes.push(
        <col
          style={{
            width: colProps.width === 'shrink' ? sanitizeShrinkWidth(shrinkWidth) : (colProps.width || ''),
            minWidth: colProps.minWidth || ''
          }}
        />
      )
    }
  }

  return (<colgroup>{colNodes}</colgroup>)
}


export function sanitizeShrinkWidth(shrinkWidth?: number) {
  /* why 4? if we do 0, it will kill any border, which are needed for computeSmallestCellWidth
  4 accounts for 2 2-pixel borders. TODO: better solution? */
  return shrinkWidth == null ? 4 : shrinkWidth
}


export function hasShrinkWidth(cols: ColProps[]) {
  for (let col of cols) {
    if (col.width === 'shrink') {
      return true
    }
  }

  return false
}


export function getScrollGridClassNames(vGrow: boolean, context: ComponentContext) {
  let classNames = [
    'scrollgrid',
    context.theme.getClass('table')
  ]

  if (vGrow) {
    classNames.push('vgrow')
  }

  return classNames
}


export function getSectionClassNames(sectionConfig: SectionConfig, wholeTableVGrow: boolean) {
  let classNames = [
    'scrollgrid__section',
    'fc-' + sectionConfig.type, // fc-head, fc-body, fc-foot
    sectionConfig.className
  ]

  if (wholeTableVGrow && sectionConfig.vGrow && sectionConfig.maxHeight == null) {
    classNames.push('vgrow')
  }

  return classNames
}


// need a method for this still?
export function getChunkClassNames(sectionConfig: SectionConfig, chunkConfig: ChunkConfig, context: ComponentContext) {
  return chunkConfig.className
}


// IE sometimes reports a certain clientHeight, but when inner content is set to that height,
// some sort of rounding error causes it to spill out and create unnecessary scrollbars. Compensate.
export const CLIENT_HEIGHT_WIGGLE = /Trident/.test(navigator.userAgent) ? 1 : 0