import { ActionsUnion, IGatsbyState, IHtmlFileState } from "../types"

const FLAG_DIRTY_NEW_PAGE = 0b0001
const FLAG_DIRTY_PAGE_QUERY = 0b0010 // TODO: this need to be PAGE_DATA and not PAGE_QUERY, but requires some shuffling
const FLAG_DIRTY_BROWSER_COMPILATION_HASH = 0b0100

type PagePath = string

function initialState(): IGatsbyState["html"] {
  return {
    trackedHtmlFiles: new Map<PagePath, IHtmlFileState>(),
    browserCompilationHash: ``,
  }
}

// TODO: figure out handling for when page ultimately is deleted (not just mark as deleted)
// TODO: mark files as not dirty once regenerated
export function htmlReducer(
  state: IGatsbyState["html"] = initialState(),
  action: ActionsUnion
): IGatsbyState["html"] {
  switch (action.type) {
    case `DELETE_CACHE`:
      return initialState()

    case `CREATE_PAGE`: {
      // CREATE_PAGE can be called even if page already exist, so we only want to do anything
      // if we don't track given page yet or if page is marked as deleted
      const { path } = action.payload

      let htmlFile = state.trackedHtmlFiles.get(path)
      if (!htmlFile) {
        htmlFile = {
          dirty: FLAG_DIRTY_NEW_PAGE,
          isDeleted: false,
          pageQueryHash: ``,
        }
        state.trackedHtmlFiles.set(path, htmlFile)
      } else if (htmlFile.isDeleted) {
        // page was recreated so we remove `isDeleted` flag
        // TBD if dirtiness need to change
        htmlFile.isDeleted = false
      }

      return state
    }

    case `DELETE_PAGE`: {
      const { path } = action.payload
      const htmlFile = state.trackedHtmlFiles.get(path)

      if (!htmlFile) {
        // invariant
        throw new Error(
          `[html reducer] how can I delete page that wasn't created (?)`
        )
      }

      htmlFile.isDeleted = true
      // TBD if dirtiness need to change
      return state
    }

    case `PAGE_QUERY_RUN`: {
      if (action.payload.isPage) {
        const htmlFile = state.trackedHtmlFiles.get(action.payload.path)
        if (!htmlFile) {
          // invariant
          throw new Error(
            `[html reducer] I received event that query for a page finished running, but I'm not aware of the page it ran for (?)`
          )
        }

        if (htmlFile.pageQueryHash !== action.payload.resultHash) {
          htmlFile.pageQueryHash = action.payload.resultHash
          htmlFile.dirty |= FLAG_DIRTY_PAGE_QUERY
        }
      }

      return state
    }

    case `SET_WEBPACK_COMPILATION_HASH`: {
      if (state.browserCompilationHash !== action.payload) {
        state.browserCompilationHash = action.payload
        state.trackedHtmlFiles.forEach(htmlFile => {
          htmlFile.dirty |= FLAG_DIRTY_BROWSER_COMPILATION_HASH
        })
      }
      return state
    }

    case `HTML_REMOVED`: {
      state.trackedHtmlFiles.delete(action.payload)
      return state
    }

    case `HTML_GENERATED`: {
      for (const path of action.payload) {
        const htmlFile = state.trackedHtmlFiles.get(path)
        if (htmlFile) {
          htmlFile.dirty = 0
        }
      }

      return state
    }

    // case `PRUNE_HTML`: {
    //   state.trackedHtmlFiles.forEach((htmlFile, path) => {
    //     if (htmlFile.isDeleted) {
    //       state.toDelete.add(path)
    //       state.trackedHtmlFiles.delete(path)
    //     } else if (htmlFile.dirty) {
    //       state.toRegenerate.add(path)
    //     }
    //   })
    //   return state
    // }
  }
  return state
}
