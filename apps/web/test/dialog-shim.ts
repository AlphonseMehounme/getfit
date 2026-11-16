// jsdom has no HTMLDialogElement.showModal/close. This test-only shim mirrors the browser behaviour the
// Dialog component relies on: `open` toggles, `close` fires a `close` event, and Escape on an open modal
// fires a cancelable `cancel` event, then closes it unless prevented.
const proto = HTMLDialogElement.prototype as HTMLDialogElement & { __shimmed?: boolean };

if (!proto.__shimmed) {
  proto.__shimmed = true;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const dialog = (event.target as Element | null)?.closest?.('dialog[open]');
    if (!(dialog instanceof HTMLDialogElement)) return;
    const cancel = new Event('cancel', { cancelable: true });
    if (dialog.dispatchEvent(cancel)) dialog.close();
  });
}
