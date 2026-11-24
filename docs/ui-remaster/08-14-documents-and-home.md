# Document tabs and Home

Home uses app-level screen state. The editor stays mounted while Home is visible, which preserves panel state, open tabs, and the current cursor and viewport. Opening a score or template returns to the editor. Closing the last document returns to Home.

The document store keeps a separate score, undo and redo history, saved revision, lock state, cursor, selection, track visibility, multivoice and multitrack view flags, display mode, and zoom for each tab. The editor remembers each tab's scroll position. A tab switch, active-tab close, or trip to Home stops playback. Save applies to the selected document, including when that document is in a background tab. Tabs opened from the same native document ID reuse the current session.

| Action | Shortcut or control |
| --- | --- |
| Create a document | New tab button or Ctrl/Cmd+N |
| Open a score | Open file or Ctrl/Cmd+O |
| Close the current tab | Close button, middle click, or Ctrl/Cmd+W |
| Switch document tabs | Ctrl+Tab and Ctrl+Shift+Tab |
| Navigate within the focused tab strip | Left, Right, Home, and End |
| Open document actions | Right click, Shift+F10, or the context menu key |

Browser-reserved shortcuts depend on the browser and platform. The in-app controls remain available. Ctrl/Cmd+1–9 stays available to the browser and existing editor shortcuts. Tab reordering is a follow-up. The browser file APIs expose file access without a desktop file-manager reveal action.

Clean tabs and file handles are session state. A page reload starts at Home and offers to recover unsaved drafts from IndexedDB, including drafts from background tabs. Native scores preserve their ID, display mode, and zoom. Opening or saving a file adds a native snapshot to the recent list. Pins and recent records persist across reloads. Clearing the recent list removes those records and leaves recovery drafts and files on disk available.

The Local category requests a folder in browsers with the File System Access API and uses a multi-file picker when folder access is unavailable. Folder handles last for the current Home view. Built-in templates use blank scores configured for guitar, bass, or piano. The example is an original four-note guitar exercise. The Library category shows the absence of a connected catalog. The preview renders the first page of a native score or built-in score and lists its tracks. It runs independently of the editor and has no audio preview.
