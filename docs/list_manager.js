/*
 * List management for PICO-8 particle system editor
 * Handles particle_list_col and emitter_list_row
 */
(function () {
    const $partList = $('#particle_list_col');
    const $emitList = $('#emitter_list_row');
    let currentPartIndex = 0, currentEmitIndex = 0;

    // Initialize instance arrays with default entries
    Editor.particles = [{ ...Editor.particle, name: 'default' }];
    Editor.emitters = [{ ...Editor.emitter, name: 'default' }];

    // Render helper
    function renderList($container, items) {
        // Remove previous rows
        $container.find('.item-row').remove();
        // Insert each item before the "new" button
        items.forEach((item, i) => {
            const $row = $('<div class="row item-row"></div>');
            const $name = $(`<div class="base blue interactive button flex-2 item-name">${item.name}</div>`)
                .attr('data-index', i);
            const $del = $(`< div class= "base red interactive button flex-1 item-delete" > delete</div > `)
                .attr('data-index', i);
            $row.append($name, $del);
            $row.insertBefore($container.find('.base.green.interactive.button'));
        });
    }

    // Update form fields for particle at index
    function updateParticle(i) {
        const p = Editor.particles[i];
        Editor.particle = { ...p };
        $('#select_particle_name').val(p.name);
        ['kind', 'life', 'size', 'color', 'physics'].forEach(prop => {
            $(`#select_particle_${prop}`).val(p[prop]).trigger('change');
        });
    }

    // Update form fields for emitter at index
    function updateEmitter(i) {
        const e = Editor.emitters[i];
        Editor.emitter = { ...e };
        $('#select_emitter_name').val(e.name);
        ['burst', 'spread', 'cone', 'delay', 'update', 'override'].forEach(prop => {
            $(`#select_emitter_${prop}`).val(e[prop]).trigger('change');
        });
    }

    // Particle list events
    $partList.on('click', '.item-name', function () {
        currentPartIndex = +$(this).attr('data-index');
        updateParticle(currentPartIndex);
    });
    $partList.on('click', '.item-delete', function () {
        const idx = +$(this).attr('data-index');
        if (idx === 0) return; // cannot delete default
        Editor.particles.splice(idx, 1);
        if (currentPartIndex >= Editor.particles.length) currentPartIndex = 0;
        renderList($partList, Editor.particles);
        updateParticle(currentPartIndex);
    });
    $partList.find('.base.green.interactive.button').click(function () {
        const copy = { ...Editor.particles[0] };
        copy.name = 'particle' + Editor.particles.length;
        Editor.particles.push(copy);
        currentPartIndex = Editor.particles.length - 1;
        renderList($partList, Editor.particles);
        updateParticle(currentPartIndex);
    });
    // Rename current particle on name input change
    $('#select_particle_name').on('input change', function () {
        Editor.particles[currentPartIndex].name = $(this).val();
        renderList($partList, Editor.particles);
    });

    // Emitter list events
    $emitList.on('click', '.item-name', function () {
        currentEmitIndex = +$(this).attr('data-index');
        updateEmitter(currentEmitIndex);
    });
    $emitList.on('click', '.item-delete', function () {
        const idx = +$(this).attr('data-index');
        if (idx === 0) return;
        Editor.emitters.splice(idx, 1);
        if (currentEmitIndex >= Editor.emitters.length) currentEmitIndex = 0;
        renderList($emitList, Editor.emitters);
        updateEmitter(currentEmitIndex);
    });
    $emitList.find('.base.green.interactive.button').click(function () {
        const copy = { ...Editor.emitters[0] };
        copy.name = 'emitter' + Editor.emitters.length;
        Editor.emitters.push(copy);
        currentEmitIndex = Editor.emitters.length - 1;
        renderList($emitList, Editor.emitters);
        updateEmitter(currentEmitIndex);
    });

    // Rename current emitter on name input change
    $('#select_emitter_name').on('input change', function () {
        Editor.emitters[currentEmitIndex].name = $(this).val();
        renderList($emitList, Editor.emitters);
    });

    // Initial render and select defaults
    renderList($partList, Editor.particles);
    renderList($emitList, Editor.emitters);
    updateParticle(0);
    updateEmitter(0);
})();
