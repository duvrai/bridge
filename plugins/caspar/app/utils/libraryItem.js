import * as asset from './asset.js'
import { baseName, libraryPath } from './libraryColumns.js'

const DEFAULT_VALUES = {
  [asset.type.still]: {
    channel: 1,
    layer: 10
  },
  [asset.type.video]: {
    channel: 1,
    layer: 10
  },
  [asset.type.audio]: {
    channel: 1,
    layer: 30
  },
  [asset.type.template]: {
    channel: 1,
    layer: 20
  }
}

/**
 * Scanner frame_rate is frames/second. CLS stores the inverse, 1/50.
 * @param { any } item
 * @returns { string | undefined }
 */
function clipFrameRate (item) {
  if (item?.scanner?.frameRate) {
    return item.scanner.frameRate
  }
  const [numText, denText] = String(item?.framerate || '').split('/')
  const numerator = Number(numText)
  const denominator = Number(denText)
  if (numerator > 0 && denominator > 0) {
    return `${denominator}/${numerator}`
  }
}

const ITEM_CONSTRUCTORS = [
  {
    if: item => [asset.type.still, asset.type.video, asset.type.audio].includes(item.type),
    fn: item => {
      return {
        type: 'bridge.caspar.media',
        data: {
          name: baseName(libraryPath(item)),
          caspar: {
            server: item?._filter?.serverId,
            target: item.name,
            path: libraryPath(item),
            ...(DEFAULT_VALUES[item.type] || {})
          },
          duration: asset.calculateDurationMs(item),
          frameRate: clipFrameRate(item)
        }
      }
    }
  },
  {
    if: item => asset.type.template === item.type,
    fn: item => {
      return {
        type: 'bridge.caspar.template',
        data: {
          name: baseName(libraryPath(item)),
          caspar: {
            server: item?._filter?.serverId,
            target: item.name,
            path: libraryPath(item),
            ...(DEFAULT_VALUES[item.type] || {})
          }
        }
      }
    }
  }
]

/**
 * Create an item init object for a library item
 * @param { import('./asset.js').LibraryAsset } libraryAsset
 * @returns { object | undefined }
 */
export function constructPlayableItemInit (libraryAsset) {
  for (const constructor of ITEM_CONSTRUCTORS) {
    if (constructor.if(libraryAsset)) {
      return constructor.fn(libraryAsset)
    }
  }
}
