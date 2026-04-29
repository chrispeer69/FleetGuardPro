// ============================================================
// PRINT — body class toggle + modal targeting for Reports/Invoices
// ============================================================
window.FG = window.FG || {};

FG.print = (function () {

  // Print a modal in isolation. modalEl is the .modal-overlay element
  // returned from FG.modal.open(...).overlay.
  // If omitted, prints whatever the body is currently showing minus the
  // chrome that print.css already hides.
  const print = (modalEl) => {
    const body = document.body;
    const company = (FG.state && FG.state.company) ? (FG.state.company().name || 'FleetGuard Pro') : 'FleetGuard Pro';

    body.classList.add('printing');
    body.dataset.printDate = new Date().toLocaleDateString();
    body.dataset.companyName = company;

    // Mark the modal we want to keep visible. print.css hides
    // .modal:not(.print-target) and the .modal-backdrop / .modal-overlay
    // sibling overlay color.
    const modalInner = modalEl ? modalEl.querySelector('.modal') : null;
    if (modalInner) modalInner.classList.add('print-target');

    // print.css doesn't hide the dashboard panels underneath, so when
    // we're printing a modal, opt the dashboard chrome out via the
    // existing [data-no-print] selector and restore on cleanup.
    const hidden = [];
    if (modalEl) {
      document.querySelectorAll('.dash-panel:not(.hidden), .topbar, #main-nav, .panel-header, .toolbar')
        .forEach(el => {
          if (!el.hasAttribute('data-no-print')) {
            el.setAttribute('data-no-print', 'fg-print');
            hidden.push(el);
          }
        });
    }

    const cleanup = () => {
      body.classList.remove('printing');
      delete body.dataset.printDate;
      delete body.dataset.companyName;
      if (modalInner) modalInner.classList.remove('print-target');
      hidden.forEach(el => {
        if (el.getAttribute('data-no-print') === 'fg-print') el.removeAttribute('data-no-print');
      });
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    window.print();

    // Safari sometimes doesn't fire afterprint; ensure cleanup
    setTimeout(() => { if (body.classList.contains('printing')) cleanup(); }, 1000);
  };

  return print;
})();
