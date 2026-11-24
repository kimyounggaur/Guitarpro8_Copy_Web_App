# Overlay and keyboard contracts

The editor window controller stores one ordered stack. Opening a second tool of the same family replaces the first. Activating a non-modal window brings it to the front. Its order is the stack index, so repeatedly clicking a window does not increase the maximum z-index. Window geometry is keyed by window ID and clamped to the available viewport after restoration and on resize.

| Surface | Interaction | Escape and focus |
| --- | --- | --- |
| Command palette | Native modal at the document tab strip, live ranking and mode-specific grammar. Arrow keys move through results. Page keys move eight rows, Home/End move to the ends, and Tab completes a suggestion. Empty Up recalls history. Alt+Up/Down recalls or restores history while typing. | Focus starts in search. Escape closes the palette and returns to its opener. |
| Add Track, Tuning, Transpose, Cleanup, File I/O, shortcut help | Modal windows using the browser top layer, named titles, focus containment and inert background. | Escape cancels the top dialog. A native confirmation over Tuning or File I/O takes precedence over its parent. |
| Chords, Scales, Instrument, Tuner, Drum Kit, Voices, Stylesheet | Movable and resizable windows. Click the score to continue editing while using the tool. Drag the title, drag the bottom corner or focus the resize button and use arrows. | Escape dismisses the topmost window. Closing an edited stylesheet preview offers Apply, Discard, or Cancel. |
| Anchored popover | Position derives from the trigger bounds. Viewport edges, scroll, and resize update its position. | Outside pointer dismisses. Escape inside dismisses and focuses the trigger. |
| Text and numeric inputs | Local typing, selection and IME take precedence. Stylesheet text/numeric edits commit on Enter or blur. | Editor music shortcuts do not run while typing. |
| Workspace and global | Workspace note input is handled by the score. The global capture listener routes registered app shortcuts and yields native button activation, text composition and modal interaction. | Closing a surface restores its opener when it is still connected. |

The stylesheet defaults to editing the current score so existing Page/Notation controls retain their behavior. “Preview changes” edits an independent draft and renders a sample of the current score (up to four bars of two tracks). Apply makes one history entry. Reset draft restores the currently applied style. A default saved under Options is a separate user preference. The Add Track wizard supports both an immediate Create with current defaults and the four-step configuration route.
