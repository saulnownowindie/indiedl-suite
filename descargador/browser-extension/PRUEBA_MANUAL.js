/*
 * IndieDL - verificacion manual de posicionamiento
 * Pegar en la consola de DevTools en Pinterest, Instagram, YouTube o TikTok.
 * No modifica nada: solo mide la barra y los controles visibles cercanos.
 */
(() => {
    const bar = document.querySelector('#indiedl-bar');
    if (!bar) {
        console.warn('IndieDL: no se encontro #indiedl-bar en esta pagina.');
        return;
    }

    const visible = (node) => {
        const r = node.getBoundingClientRect();
        const s = getComputedStyle(node);
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight &&
            r.right > 0 && r.left < innerWidth && s.display !== 'none' && s.visibility !== 'hidden';
    };

    const barRect = bar.getBoundingClientRect();
    const rows = [];

    document.querySelectorAll(
        'button[aria-label], [role="button"][aria-label], svg[aria-label], ' +
        '[data-e2e*="like"], [data-e2e*="comment"], [data-e2e*="share"], ' +
        '[data-e2e*="avatar"], [data-e2e*="follow"]'
    ).forEach((node) => {
        if (node.closest('#indiedl-bar, #indiedl-pop') || !visible(node)) return;
        const control = node.closest('button, [role="button"], a') || node;
        const r = control.getBoundingClientRect();
        const label = node.getAttribute('aria-label') || node.getAttribute('data-e2e') || '';
        if (!label) return;
        rows.push({
            control: label,
            left: Math.round(r.left),
            top: Math.round(r.top),
            right: Math.round(r.right),
            bottom: Math.round(r.bottom),
            dx: Math.round(r.left - barRect.left),
            dy: Math.round(r.top - barRect.bottom)
        });
    });

    console.log('IndieDL barra:', {
        clases: bar.className,
        left: Math.round(barRect.left),
        top: Math.round(barRect.top),
        right: Math.round(barRect.right),
        bottom: Math.round(barRect.bottom),
        visible: getComputedStyle(bar).visibility,
        dentroDelViewport: barRect.left >= 0 && barRect.top >= 0 &&
            barRect.right <= innerWidth && barRect.bottom <= innerHeight,
        barrasEnElDom: document.querySelectorAll('#indiedl-bar').length
    });
    console.table(rows.slice(0, 25));

    console.log('Referencia: dy ~ -8 a -14 significa que la barra esta justo encima del control.');
})();
