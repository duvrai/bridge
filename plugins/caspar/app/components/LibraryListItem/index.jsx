import React from 'react'
import './style.css'

import * as asset from '../../utils/asset.js'
import { formatScannerDetails } from '../../utils/mediaInfo.js'
import { constructPlayableItemInit } from '../../utils/libraryItem.js'

/**
 * @typedef { import('../../utils/asset.js').LibraryAsset } LibraryAsset
 *
 * @param {{
 *  item: LibraryAsset
 * }} arg0
 */
export const LibraryListItem = ({ item = {}, isHighlighted, isFocused, itemRef, onClick, onDoubleClick }) => {
  async function handleDragStart (e) {
    const data = constructPlayableItemInit(item)
    e.dataTransfer.setData('bridge/item', JSON.stringify(data))
    e.stopPropagation()
  }

  function handleClick () {
    const data = constructPlayableItemInit(item)
    onClick?.(data)
  }

  function handleDoubleClick () {
    const data = constructPlayableItemInit(item)
    onDoubleClick?.(data)
  }

  const details = formatScannerDetails(item?.scanner)
  const showThumbnail = item?.type === asset.type.still || item?.type === asset.type.video
  let thumbnail = null
  if (showThumbnail && item?.scanner?.thumbnail) {
    thumbnail = <img className='LibraryListItem-thumb' alt='' src={item.scanner.thumbnail} />
  } else if (showThumbnail) {
    thumbnail = <span className='LibraryListItem-thumb LibraryListItem-thumb--empty' />
  }

  return (
    <li
      ref={itemRef}
      className={`LibraryListItem${isHighlighted ? ' is-highlighted' : ''}${isFocused ? ' is-focused' : ''}`}
      onDragStart={e => handleDragStart(e)}
      onClick={e => handleClick(e)}
      onDoubleClick={e => handleDoubleClick(e)}
      draggable
    >
      {thumbnail}
      <div className='LibraryListItem-main'>
        <div className='LibraryListItem-name LibraryListItem-col' title={item?.name}>
          {item?.name}
        </div>
        {
          details && (
            <div className='LibraryListItem-details'>{details}</div>
          )
        }
      </div>
      <div>
        <div className='LibraryListItem-col LibraryListItem-metadata'>
          {item?.type}
        </div>
      </div>
    </li>
  )
}
