import React from 'react'
import bridge from 'bridge'

import './style.css'

function FolderIcon () {
  return (
    <svg className='LibraryTable-folderIcon' viewBox='0 0 16 16' aria-hidden='true'>
      <path fill='#5aa6e6' d='M1.2 3.2h4.6l1.3 1.4h7.7v8.2H1.2V3.2z' />
    </svg>
  )
}

function FileIcon () {
  return (
    <svg className='LibraryTable-folderIcon' viewBox='0 0 16 16' aria-hidden='true'>
      <path fill='#9aa0a6' d='M3 1.5h6.2L13 5.3V14.5H3V1.5zm6 1.2V6h3.3' />
    </svg>
  )
}

import * as asset from '../../utils/asset.js'
import { constructPlayableItemInit } from '../../utils/libraryItem.js'
import { formatExactSeconds } from '../../utils/mediaInfo.js'
import {
  LIBRARY_COLUMNS,
  LIBRARY_COLUMNS_STATE_PATH,
  buildLibraryRows,
  cellText,
  defaultLayout,
  folderCell,
  libraryPath,
  normalizeLayout,
  readLocalLayout,
  visibleColumns,
  writeLocalLayout
} from '../../utils/libraryColumns.js'

/**
 * @param { ReturnType<typeof defaultLayout> } layout
 */
function persistLayout (layout) {
  writeLocalLayout(layout)
  bridge.state.apply(LIBRARY_COLUMNS_STATE_PATH, layout)
}

export const LibraryTable = ({ items = [], query = '', highlightItem, onItemClick, onItemDoubleClick }) => {
  const [layout, setLayout] = React.useState(() => normalizeLayout(readLocalLayout()))
  const [columnsOpen, setColumnsOpen] = React.useState(false)
  const [focusedIndex, setFocusedIndex] = React.useState(null)
  const layoutRef = React.useRef(layout)
  const scrollRef = React.useRef()
  layoutRef.current = layout

  React.useEffect(() => {
    let cancel = false
    async function load () {
      const stored = await bridge.state.get(LIBRARY_COLUMNS_STATE_PATH)
      if (cancel || !stored) {
        return
      }
      const next = normalizeLayout(stored)
      setLayout(next)
      writeLocalLayout(next)
    }
    load()
    return () => {
      cancel = true
    }
  }, [])

  function updateLayout (recipe) {
    setLayout(current => {
      const next = normalizeLayout(recipe(current))
      persistLayout(next)
      return next
    })
  }

  function toggleColumn (id) {
    if (id === 'name') {
      return
    }
    updateLayout(current => {
      return {
        ...current,
        hidden: {
          ...current.hidden,
          [id]: !current.hidden[id]
        }
      }
    })
  }

  function moveColumn (sourceId, targetId) {
    if (!sourceId || sourceId === targetId || sourceId === 'name' || targetId === 'name') {
      return
    }
    updateLayout(current => {
      const order = current.order.filter(id => id !== sourceId)
      const index = order.indexOf(targetId)
      order.splice(index < 0 ? order.length : index, 0, sourceId)
      return { ...current, order }
    })
  }

  function toggleFolder (path) {
    updateLayout(current => {
      return {
        ...current,
        expanded: {
          ...current.expanded,
          [path]: !current.expanded?.[path]
        }
      }
    })
  }

  function toggleSort (id) {
    const column = LIBRARY_COLUMNS.find(entry => entry.id === id)
    if (!column?.sortable) {
      return
    }
    updateLayout(current => {
      const direction = current.sort.id === id && current.sort.direction === 'asc' ? 'desc' : 'asc'
      return { ...current, sort: { id, direction } }
    })
  }

  function startResize (event, id) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = layoutRef.current.widths[id]

    function move (moveEvent) {
      const width = Math.round(startWidth + moveEvent.clientX - startX)
      setLayout(current => {
        const next = normalizeLayout({
          ...current,
          widths: { ...current.widths, [id]: width }
        })
        layoutRef.current = next
        return next
      })
    }

    function stop () {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
      persistLayout(layoutRef.current)
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }

  const columns = visibleColumns(layout)
  const rows = buildLibraryRows(items, {
    expanded: layout.expanded,
    sort: layout.sort,
    forceOpen: Boolean(String(query || '').trim())
  })

  function playable (item) {
    return constructPlayableItemInit(item)
  }

  function handleKeyDown (event) {
    const row = focusedIndex != null ? rows[focusedIndex] : null
    if (event.key === 'ArrowRight' && row?.kind === 'folder') {
      event.preventDefault()
      if (!row.open) {
        toggleFolder(row.path)
      } else {
        setFocusedIndex(index => Math.min((index ?? 0) + 1, rows.length - 1))
      }
      return
    }
    if (event.key === 'ArrowLeft' && row) {
      event.preventDefault()
      if (row.kind === 'folder' && row.open && !String(query || '').trim()) {
        toggleFolder(row.path)
        return
      }
      for (let index = (focusedIndex ?? 0) - 1; index >= 0; index -= 1) {
        if (rows[index].kind === 'folder' && rows[index].depth < row.depth) {
          setFocusedIndex(index)
          return
        }
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusedIndex(index => Math.min((index ?? -1) + 1, rows.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusedIndex(index => Math.max((index ?? rows.length) - 1, 0))
    } else if (event.key === 'Enter' && focusedIndex != null) {
      event.preventDefault()
      const row = rows[focusedIndex]
      if (row?.kind === 'folder') {
        toggleFolder(row.path)
        return
      }
      onItemClick?.(playable(row?.item))
    }
  }

  return (
    <div className='LibraryTable'>
      <div className='LibraryTable-toolbar'>
        <button
          type='button'
          className='Button Button--small'
          onClick={() => setColumnsOpen(open => !open)}
        >
          Columns
        </button>
        {
          columnsOpen && (
            <div className='LibraryTable-columnMenu'>
              {
                layout.order.map(id => {
                  const column = LIBRARY_COLUMNS.find(entry => entry.id === id)
                  return (
                    <label key={id} className='LibraryTable-columnChoice'>
                      <input
                        type='checkbox'
                        checked={!layout.hidden[id]}
                        disabled={id === 'name'}
                        onChange={() => toggleColumn(id)}
                      />
                      {column?.label}
                    </label>
                  )
                })
              }
            </div>
          )
        }
      </div>
      <div
        className='LibraryTable-scroll'
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <table className='LibraryTable-table'>
          <colgroup>
            {
              columns.map(column => (
                <col key={column.id} style={{ width: layout.widths[column.id] }} />
              ))
            }
          </colgroup>
          <thead>
            <tr>
              {
                columns.map(column => {
                  const sorted = layout.sort.id === column.id
                  const marker = sorted ? (layout.sort.direction === 'asc' ? '▲' : '▼') : ''
                  return (
                    <th
                      key={column.id}
                      className={`LibraryTable-head${sorted ? ' is-sorted' : ''}`}
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => {
                        event.preventDefault()
                        moveColumn(event.dataTransfer.getData('text/column'), column.id)
                      }}
                    >
                      <span
                        className='LibraryTable-headLabel'
                        draggable
                        onDragStart={event => {
                          event.dataTransfer.setData('text/column', column.id)
                          event.dataTransfer.effectAllowed = 'move'
                        }}
                        onClick={() => toggleSort(column.id)}
                      >
                        {column.label} {marker}
                      </span>
                      <span
                        className='LibraryTable-resize'
                        onMouseDown={event => startResize(event, column.id)}
                      />
                    </th>
                  )
                })
              }
            </tr>
          </thead>
          <tbody>
            {
              rows.map((row, index) => {
                if (row.kind === 'folder') {
                  return (
                    <tr
                      key={`folder:${row.path}`}
                      className={`LibraryTable-row LibraryTable-row--folder${index === focusedIndex ? ' is-focused' : ''}`}
                      onClick={() => {
                        setFocusedIndex(index)
                        toggleFolder(row.path)
                      }}
                    >
                      {
                        columns.map(column => (
                          <td key={column.id} className='LibraryTable-cell'>
                            {
                              column.id === 'name' && (
                                <span className='LibraryTable-name' style={{ paddingLeft: `${row.depth * 16}px` }}>
                                  <span className={`LibraryTable-disclosure${row.open ? ' is-open' : ''}`} aria-hidden='true'>▶</span>
                                  <FolderIcon />
                                  <span className='LibraryTable-label'>{row.name}</span>
                                </span>
                              )
                            }
                            {
                              column.id !== 'name' && folderCell(column.id, row.count)
                            }
                          </td>
                        ))
                      }
                    </tr>
                  )
                }

                const item = row.item
                const highlighted = highlightItem && item.name === highlightItem
                const showThumb = item?.type === asset.type.still || item?.type === asset.type.video
                return (
                  <tr
                    key={item.name || index}
                    className={`LibraryTable-row${highlighted ? ' is-highlighted' : ''}${index === focusedIndex ? ' is-focused' : ''}`}
                    draggable
                    onDragStart={event => {
                      const data = playable(item)
                      if (!data) {
                        return
                      }
                      event.dataTransfer.setData('bridge/item', JSON.stringify(data))
                    }}
                    onClick={() => {
                      setFocusedIndex(index)
                      onItemClick?.(playable(item))
                    }}
                    onDoubleClick={() => onItemDoubleClick?.(playable(item))}
                  >
                    {
                      columns.map(column => (
                        <td
                          key={column.id}
                          className='LibraryTable-cell'
                          title={column.id === 'name' ? libraryPath(item) : (column.id === 'duration' ? formatExactSeconds(item?.scanner?.duration) : undefined)}
                        >
                          {
                            column.id === 'name' && (
                              <span className='LibraryTable-name' style={{ paddingLeft: `${row.depth * 16}px` }} title={libraryPath(item)}>
                                <span className='LibraryTable-disclosure LibraryTable-disclosure--spacer' aria-hidden='true' />
                                {
                                  showThumb && item?.scanner?.thumbnail
                                    ? <img className='LibraryTable-thumb' alt='' src={item.scanner.thumbnail} />
                                    : <FileIcon />
                                }
                                <span className='LibraryTable-label'>{cellText(item, column.id)}</span>
                              </span>
                            )
                          }
                          {
                            column.id === 'thumbnail' && (
                              showThumb && item?.scanner?.thumbnail
                                ? <img className='LibraryTable-thumb' alt='' src={item.scanner.thumbnail} />
                                : <span className='LibraryTable-thumb LibraryTable-thumb--empty' />
                            )
                          }
                          {
                            column.id !== 'name' && column.id !== 'thumbnail' && cellText(item, column.id)
                          }
                        </td>
                      ))
                    }
                  </tr>
                )
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
