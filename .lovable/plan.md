
# Fix Build Error in CreateMenuSimpleDialog

## Problem
The app is currently broken due to a **TypeScript/JSX build error** in `src/components/admin/disposable-menus/CreateMenuSimpleDialog.tsx`. There's a stray `</div>` closing tag on line 418 that breaks the JSX tree structure, causing the `<form>`, `<DialogContent>`, and `<Dialog>` closing tags to be mismatched.

This build error is preventing the entire app from loading -- hence the blank page you're seeing.

## Fix
Remove the extra `</div>` on line 418. The correct structure should flow from the step 3 content (ending around line 417) directly into the footer actions, all within the `<form>` element.

### Technical Detail
```text
Current (broken):
  <form ...>
    {step content...}
    </div>    <-- line 417 (closes step 3 conditional)
  </div>      <-- line 418 (EXTRA - breaks structure)
    {footer}
  </form>
  </DialogContent>
  </Dialog>

Fixed:
  <form ...>
    {step content...}
    </div>    <-- line 417 (closes step 3 conditional)
    {footer}
  </form>
  </DialogContent>
  </Dialog>
```

This is a one-line fix that will restore the app to working state.
