import { useEffect, type RefObject } from "react";

/** One modal owns focus and background interaction, including nested exits. */
export function useDialogFocus(
  root: RefObject<HTMLElement | null>,
  key: string
) {
  useEffect(() => {
    const host = root.current;
    if (!host || !key) return;
    const dialogs = Array.from(
      host.querySelectorAll<HTMLElement>('[role="dialog"]')
    );
    const dialog = dialogs.at(-1);
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const siblings = Array.from(host.children).filter(
      node => node !== dialog && !node.contains(dialog)
    ) as HTMLElement[];
    const oldInert = siblings.map(node => node.inert);
    siblings.forEach(node => {
      node.inert = true;
    });
    dialog.tabIndex = -1;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea, select, a[href], summary, [tabindex="0"]'
        )
      ).filter(node => node.getClientRects().length > 0);
    (focusable()[0] ?? dialog).focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.isComposing) return;
      const items = focusable();
      const first = items[0] ?? dialog;
      const last = items.at(-1) ?? dialog;
      if (
        !dialog.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last) ||
        items.length === 0
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node))
        (focusable()[0] ?? dialog).focus();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus);
      siblings.forEach((node, index) => {
        node.inert = oldInert[index];
      });
      if (previous?.isConnected && !previous.closest("[inert]"))
        previous.focus({ preventScroll: true });
    };
  }, [root, key]);
}
