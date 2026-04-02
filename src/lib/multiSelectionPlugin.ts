import { Plugin, PluginKey, TextSelection, Selection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const multiSelectionKey = new PluginKey('multiSelection');

export const MultiSelectionPlugin = () => {
  return new Plugin({
    key: multiSelectionKey,
    state: {
      init() {
        return {
          selections: [] as Selection[],
        };
      },
      apply(tr, value, oldState, newState) {
        const meta = tr.getMeta(multiSelectionKey);
        
        if (meta === 'clear') {
          return { selections: [] };
        }

        if (meta?.add) {
          return {
            selections: [...value.selections, meta.add],
          };
        }

        // Map selections through transactions
        if (value.selections.length > 0) {
          return {
            selections: value.selections.map(s => s.map(tr.doc, tr.mapping)).filter(s => !s.empty),
          };
        }

        return value;
      },
    },
    props: {
      decorations(state) {
        const { selections } = multiSelectionKey.getState(state);
        if (!selections || selections.length === 0) return null;

        const decos = selections.map(s => 
          Decoration.inline(s.from, s.to, { class: 'multi-selection-highlight' })
        );
        return DecorationSet.create(state.doc, decos);
      },
      handleDOMEvents: {
        mousedown(view, event) {
          if (event.ctrlKey || event.metaKey) {
            // We'll handle the selection end in mouseup
            return false;
          }
          // Clear multi-selection if clicking without Ctrl
          view.dispatch(view.state.tr.setMeta(multiSelectionKey, 'clear'));
          return false;
        },
        mouseup(view, event) {
          if (event.ctrlKey || event.metaKey) {
            const { selection } = view.state;
            if (!selection.empty) {
              view.dispatch(view.state.tr.setMeta(multiSelectionKey, { add: selection }));
              return true;
            }
          }
          return false;
        }
      }
    }
  });
};

// Helper to apply a command to all selections
export const applyToAllSelections = (editor: any, callback: (chain: any) => void) => {
  const state = editor.state;
  const { selections } = multiSelectionKey.getState(state);
  
  if (!selections || selections.length === 0) {
    callback(editor.chain().focus());
    return;
  }

  let chain = editor.chain().focus();
  // Apply to current selection first
  callback(chain);
  
  // Then apply to all stored selections
  selections.forEach((s: Selection) => {
    chain = chain.setTextSelection({ from: s.from, to: s.to });
    callback(chain);
  });
  
  chain.run();
  // Clear after applying? User might want to keep them. 
  // Let's clear for now to match expected behavior of "apply and done"
  editor.view.dispatch(editor.state.tr.setMeta(multiSelectionKey, 'clear'));
};
